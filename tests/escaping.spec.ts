import { multisplice } from "@alanscodelog/utils/multisplice.js"
import { describe, expect, it } from "vitest"

import { checkVariables, e, t, unquoted, v } from "./utils.js"

import { condition, delim, expression, pos } from "../src/ast/builders/index.js"
import { Parser } from "../src/Parser.js"


const allQuotes = ["`", "'", `"`]
const delims = ["(", ")", "["] // "]" not technically delim unless preceded by [ so will leave out for these tests
const requireEscape = ["/", " ", "\n", "\t", "\r"]

it(`escaped symbols`, () => {
	checkVariables([
		...[...requireEscape, ...allQuotes, ...delims, "\\"].map(op => `\\${op}`),
	], val => [undefined, val, unquoted, pos(0, val.length)])
})
it(`escaped array values`, () => {
	checkVariables([
		"\\[\\]",
		"\\[",
	], val => [undefined, val, unquoted, pos(0, val.length)])
	checkVariables([
		"[]",
		"[",
	], val => [undefined, val, unquoted, pos(0, val.length)], {
		arrayValues: false,
	})
})
it(`escaped operators`, () => {
	checkVariables([
		// || and && cannot be escaped like \&& if their single character version (&, |) is also enabled
		...["and", "or", "&", "|", "!", "not"].map(op => `\\${op}`),
		...["and", "or", "not"].map(op => `${op[0]}\\${op.slice(1, op.length)}`),
		...["and", "not"].map(op => `${op.slice(0, 1)}\\${op.slice(1, op.length)}`),
		...["and", "or", "&&", "||", "not"].map(op => `\\${op.split("").join("\\")}`),
	], val => [undefined, val, unquoted, pos(0, val.length)])
	checkVariables([
		...["and", "or", "&&", "||", "!", "not"].map(op => `\\${op}`),
		...["and", "or", "&&", "||", "not"].map(op => `${op[0]}\\${op.slice(1, op.length)}`),
		...["and"].map(op => `${op.slice(0, 1)}\\${op.slice(1, op.length)}`),
		...["and", "or", "&&", "||", "not"].map(op => `\\${op.split("").join("\\")}`),
	], val => [undefined, val, unquoted, pos(0, val.length)], {
		keywords: {
			// basically disable & and |
			and: [{ value: "&&", isSymbol: true }, { value: "AND", isSymbol: false }, { value: "and", isSymbol: false }],
			or: [{ value: "||", isSymbol: true }, { value: "OR", isSymbol: false }, { value: "or", isSymbol: false }],
		},
	})
})
it(`disabled operators`, () => {
	checkVariables([
		...["and", "or", "&&", "&", "|", "||", "!", "not"],
	], val => [undefined, val, unquoted, pos(0, val.length)], {
		keywords: {
			and: [],
			or: [],
			not: [],
		},
	})
})
it(`quoted variables`, () => {
	checkVariables([
		...allQuotes.map(quote => ["and", "or", "&&", "&", "|", "||", "!", "not", ...requireEscape, ...delims].map(op => `${quote}${op}${quote}`)).flat(),
		...allQuotes.map(quote => `${quote}a${quote}`),
		...allQuotes.map(quote => `${quote}\\${quote}${quote}`),
		...allQuotes.map(quote => {
			const quotesExceptThisOne = multisplice([...allQuotes], allQuotes.indexOf(quote), 1).array.join("")
			return `${quote}${quotesExceptThisOne}${quote}`
		}),
	], val => [undefined, val.slice(1, val.length - 1), delim(val[0], val[0]) as any, pos(1, val.length - 1)])
})
it(`quoted variables - empty value`, () => {
	checkVariables([
		...allQuotes.map(quote => `${quote}${quote}`),
	], val => [undefined, e(val, val[0], [""]), delim(val[0], val[1]) as any, pos(1, 1)])
})
describe("errors on unmatched pairs", () => {
	it(`partially quoted variables`, () => {
		checkVariables([
			...allQuotes.map(quote => ["and", "or", "&&", "&", "|", "||", "!", "not"].map(op => `${quote}${op}`)).flat(),
			...allQuotes.map(quote => `${quote}a`),
			...allQuotes.map(quote => `${quote}\\${quote}`),
		], val => [undefined, val.slice(1), delim(val[0], false) as any, pos(1, val.length)])
	})
	it(`partially quoted - no value`, () => {
		checkVariables([
			...allQuotes.map(quote => `${quote}`),
		], val => [undefined, e(val, val[0], [""]), delim(val[0], false) as any, pos(1, 1)])
	})
	it(`partially quoted quotes`, () => {
		checkVariables([
			...[allQuotes[0]].map(quote => {
				const quotesExceptThisOne = multisplice([...allQuotes], allQuotes.indexOf(quote), 1).array.join("")

				return `${quote}${quotesExceptThisOne}`
			}),
		], val => [undefined, val.slice(1), delim(val[0], false) as any, pos(1, val.length)])
	})
	it(`a || b"`, () => {
		// unlike parens this is possible to detect
		const input = `a || b"`
		const expected = expression(
			condition(
				v(input, "a"),
			),
			t(input, "||"),
			condition(
				v(input, "b", delim(false, "\"")),
			),
		)

		expect(new Parser().parse(input)).to.deep.equal(expected)
	})
	describe("operator whitespace exception", () => {
		it(`"a"or"b"`, () => {
			const input = `"a"or"b"`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim("\"", "\"")),
				),
				t(input, "or"),
				condition(
					v(input, "b", delim("\"", "\"")),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`"aor " b"`, () => {
			const input = `"aor " b"`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "aor ", delim("\"", "\"")),
				),
				e(input, "or \"", ["&&", "||"]),
				condition(
					v(input, "b", delim(false, "\"")),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`"a"or b"`, () => {
			const input = `"a"or b"`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim("\"", "\"")),
				),
				t(input, "or"),
				condition(
					v(input, "b", delim(false, "\"")),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`"a"orb"`, () => {
			const input = `"a"orb"`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim("\"", "\"")),
				),
				e(input, "a\"", ["&&", "||"]),
				condition(
					v(input, "orb", delim(false, "\"")),
				),
			)

			expect(ast as any).to.deep.equal(expected)
		})
		it(`a"or"b"`, () => {
			const input = `a"or"b"`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim(false, "\"")),
				),
				t(input, "or"),
				condition(
					v(input, "b", delim("\"", "\"")),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`"a"or"b`, () => {
			const input = `"a"or"b`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim("\"", "\"")),
				),
				t(input, "or"),
				condition(
					v(input, "b", delim("\"", false)),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`a"or"b`, () => {
			const input = `a"or"b`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim(false, "\"")),
				),
				t(input, "or"),
				condition(
					v(input, "b", delim("\"", false)),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`a"orb`, () => {
			const input = `a"orb`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "a", delim(false, "\"")),
				),
				e(input, "a\"", ["&&", "||"]),
				condition(
					v(input, "orb"),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
		it(`aor"b`, () => {
			const input = `aor"b`
			const ast = new Parser().parse(input)
			const expected = expression(
				condition(
					v(input, "aor", delim(false, "\"")),
				),
				e(input, "aor\"", ["&&", "||"]),
				condition(
					v(input, "b"),
				),
			)
			expect(ast as any).to.deep.equal(expected)
		})
	})
})
