import type { DeepPartial } from "@alanscodelog/utils"
import { expect } from "vitest"

import { condition, error, pos, token, type, variable } from "../src/ast/builders/index.js"
import { Condition, type ErrorToken, Expression, type ValidToken, type VariableNode } from "../src/ast/classes/index.js"
import { Parser } from "../src/Parser.js"
import { type ExtractTokenType, type Position,TOKEN_TYPE } from "../src/types/index.js"
import type { ParserOptions } from "../src/types/parser.js"


// for delims
export const unquoted = undefined
export const missing = false
export const single = "'"
export const double = "\""
export const tick = "`"


const logObjects = [undefined, true]

/** A utility for when manually putting in the position gets out of hand. */
export const findPos = (input: string, str: string): Position => {
	const index = input.indexOf(str)
	if (index === -1) throw new Error(`cannot find string "${str}" in "${input}" when creating position.`)
	return pos(index, index + str.length)
}

export const checkVariables = (
	values: string[],
	args: (val: string) => Parameters<typeof variable>,
	opts?: DeepPartial<ParserOptions>,
): void => {
	for (const val of values) {
		expect(new Parser(opts).parse(val)).to.deep.equal(
			condition(
				variable(...args(val)),
			), ...logObjects as any[])
	}
}

/**
 * Quickly create a valid @see ValidToken .
 * Given the full string fed to the parser and a token value (only operators or delimiters) returns a token of the correct type with the positions auto-filled.
 */
export const t = <T extends string, TForceType extends TOKEN_TYPE>(
	input: string, value: T, tokenType?: TForceType,
): TForceType extends TOKEN_TYPE ? ValidToken<TForceType> : ValidToken<ExtractTokenType<T>> =>
	token(tokenType ?? type(value) as any, value, findPos(input, value)) as any

/**
 * Quickly create a valid @see Variable .
 * Given the full string fed to the parser and the value for the variable returns a variable with the positions auto-filled.
 */
export const v = <T extends string>(
	input: string, value: T, opts: Parameters<typeof variable>["2"] = undefined, prefix?: Parameters<typeof variable>["0"],
): VariableNode =>
	variable(prefix, value, opts, findPos(input, value)) as any

/**
 * Quickly create an error @see ValidToken.
 *
 * Given the input, a string right before the error, and the expected token types, returns an error token.
 *
 */
export const e = <T extends string>(
	input: string, beforeError: string, expected: T[],
): ErrorToken<ExtractTokenType<T>> => error<ExtractTokenType<T>>(findPos(input, beforeError).end, expected as any)

type ConditionConstructor = ConstructorParameters<typeof Condition>[0]
export const nCondition = (
	property: string | undefined,
	value: ConditionConstructor["value"] = true,
	negate: ConditionConstructor["negate"] = false,
	operator: ConditionConstructor["operator"] = undefined,

 
) => new Condition({ property: property === undefined ? [] : property.split("."), operator, value, negate })

type ExpressionConstructor = ConstructorParameters<typeof Expression>[0]
export const nExpression = (
	left: ExpressionConstructor["left"],
	operator: string,
	right: ExpressionConstructor["right"],

) => new Expression({ left, right, operator: operator === "&&" ? TOKEN_TYPE.AND : TOKEN_TYPE.OR })
