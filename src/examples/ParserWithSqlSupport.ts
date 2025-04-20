import { unreachable } from "@alanscodelog/utils/unreachable.js"

import { Parser } from "../Parser.js"
import { AST_TYPE, type NormalizedCondition, type NormalizedExpression, type Position,TOKEN_TYPE } from "../types/ast.js"

export interface BasePropertyDefinition {
	name: string
	/** Supported types are: string, boolean, int, float, date. */
	type: string
	/** Return how to access the column in the WHERE condition of the SQL query, useful for json properties. It is up to you to properly quote the value if needed. */
	transformToColumn?: (key: string, name: string) => string
	/**
	 * A function that can be used to transform the value before it is inserted into the SQL query. Useful for types like arrays. It is up to you to properly escape values if you use the second parameter which contains the unescaped value.
	 */
	transformValue?: (value: any, unescapedValue: any) => any | any[]
	isArray?: boolean
	/** If undefined, it's assumed all operators are supported. This should only include the final operator (see {@link BaseOperatorDefinition.operator}), it doesn't need to include it's aliases. */
	supportedOperators?: string[]
	/** Further transform the value after the basic parsing has been done. Useful to, for example, parse other strings (e.g. now, today, tomorrow) as dates. */
	postParse?: (value: any) => any
}
export interface BaseOperatorDefinition {
	/** The final operator to use in the SQL query and while evaluating. */
	operator: string
	/** All aliases the user can use to specify the operator. They need not include the real final operator. */
	operators: string[]
	/** All negated aliases to the operator. If an operator is listed here, it will be used to "invert" a condition when normalizing. e.g. < can list >= as a negated operator. This greatly simplifies queries. */
	negatedOperators?: string[]
	/** How to compare the value when evualuating a condition. This is only used if using `evaluate`. */
	valueComparer: (condition: any, contextValue: any) => boolean
}
export type SqlParserError =
	| "invalidKey"
	| "unknownProperty"
	| "unknownOperator"
	| "unknownOperatorForType"
	| "invalidValueType"
/*
 * Creates an example parser with a `toSql` method that can be used to convert an AST to a a safe SQL query.
 *
 * The parser assumes all column names (i.e. the propertyDefinitions) and operators (i.e. operatorDefinitions) are vetted and safe to use in the SQL queries. They are double quoted (unless transformToColumn is specificed) so you can use special characters if needed. You can use the `transformToColumn` option to specify a custom name (e.g. for json columns) that will be left as is.
 *
 * Values are escaped with the given `sqlEscapeValue`. If using drizzle, for simple tables and types, you can just do and it'll be safe. More complex types, such as arrays, or json properties are more comlicated and you'll probably want to specify the definition's transformValue option. See the examples tests for examples.
 * ```ts
 * const parser = new ParserWithSqlSupport(
 * 	propertyDefinitions,
 * 	{
 * 		sqlEscapeValue: (value: string) => sql`${value}`
 * 	}
 * )
 * ```
 *
 */
export class ParserWithSqlSupport<TErrorToken extends
	Position & {
		type: SqlParserError
		message?: string
	} =
	Position & {
		type: SqlParserError
		message?: string
	},
	TPropertyDefinition extends BasePropertyDefinition = BasePropertyDefinition,
	TPropertyDefinitions extends Record<string, TPropertyDefinition> = Record<string, TPropertyDefinition>,
	TOperatorDefinition extends BaseOperatorDefinition = BaseOperatorDefinition,
	TOperatorDefinitions extends Record<string, TOperatorDefinition> = Record<string, TOperatorDefinition>,
	TSqlEscapeValue extends (value: string) => any | ReturnType<TSqlEscapeValue> = (value: string) => any,
> extends Parser<TErrorToken> {
	sqlEscapeValue: TSqlEscapeValue

	operatorMap: Record<string, string>

	propertyDefinitions: TPropertyDefinitions

	operatorDefinitions: TOperatorDefinitions

	constructor(
		propertyDefinitions: TPropertyDefinitions,
		operatorDefinitions: TOperatorDefinitions,
		{ sqlEscapeValue }: { sqlEscapeValue: TSqlEscapeValue }
	) {
		const operators = []
		const operatorMap: Record<string, string> = {}
		for (const value of Object.values(operatorDefinitions)) {
			for (const operator of value.operators) {
				operatorMap[operator] = value.operator
				operators.push(operator)
			}
			if (value.negatedOperators) {
				for (const operator of value.negatedOperators) {
					operatorMap[operator] = value.operator
					operators.push(operator)
				}
			}
		}
		super({
			arrayValues: true,
			regexValues: false,
			keywords: {
				and: [{ isSymbol: true, value: "&&" }],
				or: [{ isSymbol: true, value: "||" }],
				not: [{ isSymbol: true, value: "!" }],
			},
			customPropertyOperators: operators,
			prefixableGroups: false,
			valueComparer: (condition, contextValue, _context) => {
				if (typeof condition.value !== typeof contextValue) {
					throw new Error(`Expected type of property ${condition.property[0]} to be the same type as the context value ${contextValue} (${typeof contextValue}). If the ast has been validated this is likely because the type of the context value is incorrect.`)
				}
				
				const prop = condition.property[0]
				if (!prop) unreachable("Did you validate the ast before evaluating it?")

				const propDefinition = propertyDefinitions[prop]
				const operatorDefinition = condition.operator && operatorDefinitions[condition.operator]
				if (!operatorDefinition) unreachable("Did you validate the ast before evaluating it?")

				const isSupported = !propDefinition.supportedOperators?.includes(condition.operator!)
				if (!isSupported) unreachable("Did you validate the ast before evaluating it?")

				const res = operatorDefinition.valueComparer(condition, contextValue)
				return res
			},
			valueValidator: (_contextValue, query): TErrorToken[] | void => {
				const prop = query.propertyKeys[0]
				let tokens: TErrorToken[] = []
				const propDefinition = propertyDefinitions[prop]
				if (!propDefinition) {
					tokens = tokens.concat(query.property.map(token => ({
						start: token.start,
						end: token.end,
						type: "unknownProperty",
					})) as TErrorToken[])
					return tokens
				}
				const op = query.operator
				const opKey = op && operatorMap[op.value]
				if (!op || !opKey) {
					tokens.push({
						start: (op ?? query.condition)?.start,
						end: (op ?? query.condition)?.end,
						type: "unknownOperator",
					} as TErrorToken)
				} else {
					if (propDefinition.supportedOperators && !propDefinition.supportedOperators?.includes(opKey)) {
						tokens.push({
							start: query.condition.start,
							end: query.condition.end,
							type: "unknownOperatorForType",
						} as TErrorToken)
					}
				}

				const val = query.value
				if (Array.isArray(val)) {
					for (const v of val) {
						if (v.type !== "VARIABLE") unreachable()
						const res = convertAndValidateValue(query.isQuoted, v.value.value, prop, propertyDefinitions, { isArray: true })
						if (res instanceof Error) {
							if (v.type !== "VARIABLE") unreachable()
							const token = v
							tokens.push({
								start: token.start,
								end: token.end,
								type: "invalidValueType",
								message: res.message,
							} as TErrorToken)
						}
					}
					if (tokens.length > 0) return tokens
					return
				}

				if (val?.type !== "VARIABLE") unreachable()
				const value = val.value.value
				const res = convertAndValidateValue(query.isQuoted, value, prop, propertyDefinitions)
				if (res instanceof Error) {
					if (!query.value || query.value.type !== "VARIABLE") unreachable()
					const token = query.value.value
					tokens.push({
						start: token.start,
						end: token.end,
						type: "invalidValueType",
						message: res.message,
					} as TErrorToken)
				}
				
				if (tokens.length > 0) return tokens
			},
			conditionNormalizer(query) {
				const prop = query.property?.[0]
				if (!prop) unreachable("Did you validate the ast before normalizing it?")
				const propDefinition = propertyDefinitions[prop]

				let finalValue
				if (Array.isArray(query.value)) {
					const values = []
					if (query.condition.value.type !== AST_TYPE.ARRAY) unreachable()
					const raw = query.condition.value.values
					for (let i = 0; i < query.value.length; i += 1) {
						const token = raw[i]
						const val = query.value[i]
						const isQuoted = !!token.quote
						const res = convertAndValidateValue(isQuoted, val, prop, propertyDefinitions, { isArray: true })
						if (res instanceof Error) throw res
						values.push(res)
					}
					finalValue = values
				} else {
					finalValue = convertAndValidateValue(query.isQuoted, query.value, prop, propertyDefinitions)
					if (propDefinition.isArray) {
						finalValue = [finalValue]
					}
				}

				let finalOperator: any = query.operator
				if (finalValue instanceof Error) throw finalValue
				const opKey = query.operator && operatorMap[query.operator]
				if (!opKey) unreachable("Did you validate the ast before normalizing it?")
					
				const operatorDefinition = opKey && operatorDefinitions[opKey]
				if (!operatorDefinition) unreachable("Did you validate the ast before normalizing it?")
			

				const isNegatableOperator = operatorDefinition.negatedOperators?.includes(query.operator!)

				finalOperator = operatorDefinition.operator
				let isNegated = query.isNegated
				if (isNegatableOperator) {
					isNegated = !isNegated
				}
				
				return { value: finalValue, operator: finalOperator, negate: isNegated }
			},
		})
		this.propertyDefinitions = propertyDefinitions
		this.operatorDefinitions = operatorDefinitions
		this.operatorMap = operatorMap
		this.sqlEscapeValue = sqlEscapeValue
	}
	
	toSql<T>(
		ast: NormalizedExpression<any, any> | NormalizedCondition<any, any>,
		/**
		 * Optionally convert the raw strings to something else. If uding drizzle, you can pass sql.raw here. So later you can just sql.join the return of the function:
		 *
		 * ```ts
		 * sql.join([
		 * 	sql.raw(db.select().from(someTable).toSQL().sql),
		 * 	sql.raw(`where`),
		 * 	...parser.toSql(ast, sql.raw)
		 * ], sql` `)
		 * ```
		 */
		wrapStrings?: (value: string) => T,
	): (ReturnType<TSqlEscapeValue> | typeof wrapStrings extends undefined ? string : T)[] {
		this._checkEvaluationOptions()
		const chunks = []

		if (ast.type === AST_TYPE.NORMALIZED_CONDITION) {
			const prop = ast.property?.[0]
			const definition = this.propertyDefinitions[prop]
			const value = ast.value
			const col = definition.transformToColumn?.(prop, definition.name) ?? `"${prop}"`
			const op = ast.operator
			if (ast.negate) {
				chunks.push(wrapStrings?.(`NOT(`) ?? `NOT(`)
			}
			chunks.push(wrapStrings?.(`${col} `) ?? `${col} `)
			chunks.push(wrapStrings?.(`${op} `) ?? `${op} `)
			const val = this.sqlEscapeValue(value)
			if (definition.transformValue) {
				const transformed = definition.transformValue(val, value)
				if (Array.isArray(transformed)) {
					chunks.push(...transformed)
				} else {
					chunks.push(transformed)
				}
			} else {
				chunks.push(val)
			}
			if (ast.negate) {
				chunks.push(wrapStrings?.(`)`) ?? `)`)
			}
			return chunks
		}
		if (ast.type === AST_TYPE.NORMALIZED_EXPRESSION) {
			const left = this.toSql(ast.left, wrapStrings)
			const right = this.toSql(ast.right, wrapStrings)
			const op = ast.operator === TOKEN_TYPE.AND ? "AND" : "OR"
			chunks.push(wrapStrings?.(`(`) ?? `(`)
			chunks.push(...left)
			chunks.push(wrapStrings?.(` ${op} `) ?? ` ${op} `)
			chunks.push(...right)
			chunks.push(wrapStrings?.(`)`) ?? `)`)
			return chunks as any
		}

		return unreachable()
	}
}
export function createTypeError(prop: string, type: string, isArray: boolean): Error {
	if (isArray) {
		return new Error(`Property ${prop} must contain items of type ${type}.`)
	}
	return new Error(`Property ${prop} must be of type ${type}.`)
}

export function convertAndValidateValue(
	isQuoted: boolean,
	value: any,
	prop: string,
	propertyDefinitions: Record<string, BasePropertyDefinition>,
	{ isArray = false }: { isArray?: boolean } = {},
): any {
	let finalValue: any = value
	let isFloat = false
	const propDefinition = propertyDefinitions[prop]
	
	if (typeof value === "string" && !isQuoted) {
		if (finalValue === "true") {
			finalValue = true
		} else if (finalValue === "false") {
			finalValue = false
		} else {
			const asNum = parseInt(value, 10)
			if (!isNaN(asNum)) {
				finalValue = asNum
			} else {
				const asFloat = parseFloat(value)
				if (!isNaN(asFloat)) {
					finalValue = asFloat
					isFloat = true
				}
			}
		}
	}
	const type = propDefinition.type
	finalValue = propDefinition.postParse?.(finalValue) ?? finalValue

	switch (type) {
		case "integer":
		case "float": {
			if (typeof finalValue !== "number" || (type === "float" && !isFloat) || (type === "integer" && isFloat)) {
				return createTypeError(prop, type, isArray)
			}
			break
		}
		case "string":
		case "boolean": {
			if (typeof finalValue !== propDefinition.type) {
				return createTypeError(prop, type, isArray)
			}
			break
		}
		case "date": {
			if (finalValue instanceof Date) {
				break
			}
			const maybeDate = new Date(finalValue)
			if (isNaN(maybeDate.getTime())) {
				return createTypeError(prop, "date", isArray)
			} else {
				finalValue = maybeDate
			}
			break
		}
	}
	
	return finalValue
}
