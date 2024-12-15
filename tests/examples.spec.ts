import { type SQL, sql } from "drizzle-orm"
import { PgDialect, type PgTable } from "drizzle-orm/pg-core"
import { type PgliteDatabase } from "drizzle-orm/pglite"
import { afterEach, describe, expect, it } from "vitest"

import { testEntry, testEntryJson } from "./db/schema.js"
import { useDb } from "./db/useDb.js"

import { type BaseOperatorDefinition, type BasePropertyDefinition, ParserWithSqlSupport } from "../src/examples/ParserWithSqlSupport.js"
import { ShortcutContextParser } from "../src/examples/ShortcutContextParser.js"
import { extractTokens } from "../src/utils/extractTokens.js"

const pgDialect = new PgDialect()


function toQuery(db: PgliteDatabase, table: PgTable, parserSql: SQL[]) {
	return sql.join([
		sql.raw(db.select().from(table).toSQL().sql),
		sql.raw(`where`),
		...parserSql
	], sql` `)
}

describe("sqlQueryGenerator", () => {
	afterEach(async () => {
		const { clearDb } = await useDb()
		await clearDb()
	})
	const operatorDefinitions: Record<string, BaseOperatorDefinition> = {
		"=": {
			operator: "=",
			operators: ["=="],
			negatedOperators: ["!="],
			valueComparer: (condition, contextValue) => contextValue === condition.value,
		},
		">": {
			operator: ">",
			operators: [">"],
			negatedOperators: ["<=", "before"],
			valueComparer: (condition, contextValue) => contextValue > condition.value,
		},
		"<": {
			operator: "<",
			operators: ["<"],
			negatedOperators: [">=", "after"],
			valueComparer: (condition, contextValue) => contextValue < condition.value,
		},
		"@>": {
			operator: "@>",
			operators: ["contains"],
			valueComparer: (condition, contextValue) => condition.value.every((val: any) => contextValue.includes(val)),
		}
	}
	const basePropertyDefinitions: Record<string, BasePropertyDefinition > = {
		string: {
			name: "String",
			type: "string",
		},
		date: {
			name: "Date",
			type: "date",
			postParse: (value: any): Date | void => {
				if (value === "now") return new Date()
			}
		},
		boolean: {
			name: "Boolean",
			type: "boolean",
		},
		number: {
			name: "Number",
			type: "integer",
		},
		array: {
			name: "Array",
			type: "string",
			isArray: true,
			transformValue: (_, unescaped: any) => {
				const chunks: any[] = []
				chunks.push(sql.raw(`ARRAY[`))
				let first = true
				for (const val of unescaped) {
					if (!first) {
						chunks.push(sql.raw(`,`))
					}
					first = false
					chunks.push(sql`${val}`)
				}
				chunks.push(sql.raw(`]`))
				return chunks
				// return [sql.raw(`ARRAY[ ${unescaped.map(v => `' ${v.replaceAll("'", "\\'")}`).join(",")}`) ,]
			}
		}
	}
	const jsonPropertyDefinitions: Record<string, BasePropertyDefinition> = {
		string: {
			...basePropertyDefinitions.string,
			transformToColumn: name => `(json->>'${name}')::text`,
		},
		number: {
			...basePropertyDefinitions.number,
			transformToColumn: name => `(json->>'${name}')::integer`,
		},
		boolean: {
			...basePropertyDefinitions.boolean,
			transformToColumn: name => `(json->>'${name}')::boolean`,
		},
		date: {
			...basePropertyDefinitions.date,
			transformToColumn: name => `(json->>'${name}')::timestamp`,
		},
		array: {
			...basePropertyDefinitions.array,
			transformToColumn: (name: string) => `(json->'${name}')`,
			transformValue: (_val: any, unescapedVal: string[]) => {
				// the quote escaping is not needed, it's safe to not do it,
				// but queries will error without it since the database won't be able to
				// parse the array
				const stringArray = `[${unescapedVal.map(v => `"${v.replaceAll("\"", "\\\"")}"`).join(",")}]`
				return [
					sql`${stringArray}::jsonb`,
				]
			}
			,
		}
	}

	const sqlEscapeValue = (value: string) => sql`${value}`
	const context = {
		string: "test",
		date: new Date(),
		boolean: true,
		number: 11,
		array: ["a", "b", "c"]
	}
	it("ParserWithSqlSupport - basic", async () => {
		const parser = new ParserWithSqlSupport(
			basePropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue }
		)
		const input = `string == 'test' && date > '2020-01-01' && boolean == true && number > 10 && (array contains 'z' || array contains ['b' 'a'])`
		const ast = parser.parse(input)
		expect(parser.validate(ast)).to.deep.equal([])
		
		const normalized = parser.normalize(ast)
		expect(parser.evaluate(normalized, context)).to.equal(true)
		const { db } = await useDb()
		const sqlQuery = toQuery(db, testEntry, parser.toSql(normalized, sql.raw))
		await db.insert(testEntry).values({
			id: 0,
			...context
		}).returning()

		
		const res = await db.execute(sqlQuery)
		expect(res.rows.length).to.equal(1)
		{
			/* eslint-disable @typescript-eslint/no-shadow */
			const negatedInput = `!(${input})`
			const ast = parser.parse(negatedInput)
			expect(parser.validate(ast)).to.deep.equal([])
			const normalized = parser.normalize(ast)
			expect(parser.evaluate(normalized, context)).to.equal(false)
			const sqlQuery = toQuery(db, testEntry, parser.toSql(normalized, sql.raw))
			const res = await db.execute(sqlQuery)
			expect(res.rows.length).to.equal(0)
		}
	})
	it("ParserWithSqlSupport - error - unknown property", () => {
		const parser = new ParserWithSqlSupport(
			basePropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue: (value: string) => sql`${value}` }
		)
		const input = "unknown == 10"

		const ast = parser.parse(input)
		const res = parser.validate(ast).map(entry => {
			delete entry.message
			return entry
		})
		expect(res).to.deep.equal([
			{ start: 0, end: 7, type: "unknownProperty" },
		])
	})
	it("ParserWithSqlSupport - error - wrong type", () => {
		const parser = new ParserWithSqlSupport(
			basePropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue: (value: string) => sql`${value}` }
		)
		const inputs = [
			["string == 10", 10,12],
			["number == '10'", 11, 13],
			["boolean == 10", 11, 13],
			["date == '--'", 9, 11],
			["array contains 1", 15, 16],
			["array contains ['a' 1]", 20, 21],
		] as const

		for (const [input, errorStart, errorEnd] of inputs) {
			const ast = parser.parse(input)
			const res = parser.validate(ast).map(entry => {
				delete entry.message
				return entry
			})
			expect(res).to.deep.equal([
				{
					start: errorStart,
					end: errorEnd,
					type: "invalidValueType",
				},
			])
		}
	})
	it("ParserWithSqlSupport - errors - multiple", async () => {
		const parser = new ParserWithSqlSupport(
			basePropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue: (value: string) => sql`${value}` }
		)
		const input = `unknown == 10 && string == 10 && number == '10' && boolean == 10 && date == '--' && array contains 1 && array contains [ 1 ]`

		const ast = parser.parse(input)
		const res = parser.validate(ast).map(entry => {
			delete entry.message
			return entry
		})
		expect(res.length).to.equal(7)
	})
	it("ParserWithSqlSupport - with json properties", async () => {
		const parser = new ParserWithSqlSupport(
			jsonPropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue }
		)
		const input = ` string == 'test' && date > '2020-01-01' && boolean == true && number > 10 && (array contains 'z' || array contains ['b' 'a'])`
		const ast = parser.parse(input)
		expect(parser.validate(ast)).to.deep.equal([])
		const normalized = parser.normalize(ast)
		expect(parser.evaluate(normalized, context)).to.equal(true)
		const { db } = await useDb()
		const sqlQuery = toQuery(db, testEntryJson, parser.toSql(normalized, sql.raw))
		await db.insert(testEntryJson).values({
			id: 0,
			json: context
		}).returning()

		const res = await db.execute(sqlQuery)
		expect(res.rows.length).to.equal(1)
		{
			/* eslint-disable @typescript-eslint/no-shadow */
			const negatedInput = `!(${input})`
			const ast = parser.parse(negatedInput)
			expect(parser.validate(ast)).to.deep.equal([])
			const normalized = parser.normalize(ast)
			expect(parser.evaluate(normalized, context)).to.equal(false)
			const sqlQuery = toQuery(db, testEntryJson, parser.toSql(normalized, sql.raw))
			const res = await db.execute(sqlQuery)
			expect(res.rows.length).to.equal(0)
		}
	})
	it("ParserWithSqlSupport - array escapes properly", async () => {
		const parser = new ParserWithSqlSupport(
			basePropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue }
		)

		const input = `array contains ['\\'a']`
		const ast = parser.parse(input)
		expect(parser.validate(ast)).to.deep.equal([])
		const normalized = parser.normalize(ast)
		const { db } = await useDb()
		const sqlQuery = toQuery(db, testEntry, parser.toSql(normalized, sql.raw))
		
		await db.insert(testEntry).values({
			id: 1,
			...context,
			array: ["'a"]
		}).returning()

		const res = await db.execute(sqlQuery)
		expect(res.rows.length).to.equal(1)
	})
	it("ParserWithSqlSupport - json array escapes properly", async () => {
		const parser = new ParserWithSqlSupport(
			jsonPropertyDefinitions,
			operatorDefinitions,
			{ sqlEscapeValue }
		)
		const input = `array contains ['\\"a']`
		const ast = parser.parse(input)
		expect(parser.validate(ast)).to.deep.equal([])
		const normalized = parser.normalize(ast)
		const { db } = await useDb()
		const sqlQuery = toQuery(db, testEntryJson, parser.toSql(normalized, sql.raw))
		await db.insert(testEntryJson).values({
			id: 1,
			json: {
				...context,
				array: ["\"a"]
			}
		}).returning()

		const res = await db.execute(sqlQuery)
		expect(res.rows.length).to.equal(1)
	})
})
describe("shortcutContextParser", () => {
	it("ContextParser", () => {
		const dummyContext = {
			a: { b: { c: false } },
			d: false,
			e: true,
		}
		const parser = new ShortcutContextParser(dummyContext)
		expect(parser.validKeys).to.deep.equal(["a.b.c", "d", "e"])
		expect(parser.regexablekeys).to.deep.equal(["e"])
		const input = "a.(b(c)) || e != /regex/"

		const ast = parser.parse(input)
		const normalized = parser.normalize(ast)

		expect(parser.validate(ast)).to.deep.equal([])
		//
		const context = {
			a: { b: { c: true } },
			d: true,
			e: "regexable",
		}
		expect(parser.evaluate(normalized, context)).to.equal(true)
		{
			const negatedInput = `!(${input})`
			const ast = parser.parse(negatedInput)
			const normalized = parser.normalize(ast)
			expect(parser.evaluate(normalized, context)).to.equal(false)
		}
	})

	it("ContextParser - errors", () => {
		const context = {
			a: { b: { c: true } },
			d: true,
			e: false,
		}
		const parser = new ShortcutContextParser(context)
		const input = "a(b(invalid)) || e == /regex/ww"

		const ast = parser.parse(input)

		expect(parser.validate(ast)).to.deep.equal([
			{ start: 0, end: 1, type: "invalidKey" },
			{ start: 2, end: 3, type: "invalidKey" },
			{ start: 4, end: 11, type: "invalidKey" },
			{ start: 17, end: 18, type: "unregexableKey" },
			{ start: 29, end: 30, type: "invalidRegexFlag" },
			{ start: 30, end: 31, type: "duplicateRegexFlag" },
			{ start: 30, end: 31, type: "invalidRegexFlag" },
		])
	})
})
