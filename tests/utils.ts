import type { DeepPartial } from "@alanscodelog/utils"
import { expect } from "vitest"

import { condition, error, pos, token, type, variable } from "../src/ast/builders/index.js"
import { createCondition } from "../src/ast/createNormalizedCondition.js"
import { createExpression } from "../src/ast/createNormalizedExpression.js"
import { Parser } from "../src/Parser.js"
import {
	type ErrorToken,
	type ExtractToken,
	type FirstParam,
	type Position,
	TOKEN_TYPE,
	type TokenType,
	type ValidToken,
	type VariableNode,
} from "../src/types/index.js"
import type { ParserOptions } from "../src/types/parser.js"


// for delims
export const unquoted = undefined
export const missing = false
export const single = "'"
export const double = "\""
export const tick = "`"


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
			)
		)
	}
}

/**
 * Quickly create a valid {@link ValidToken} .
 * Given the full string fed to the parser and a token value (only operators or delimiters) returns a token of the correct type with the positions auto-filled.
 */
export const t = <T extends string, TForceType extends TokenType>(
	input: string, value: T, tokenType?: TForceType,
): TForceType extends TokenType ? ValidToken<TForceType> : ValidToken<ExtractToken<T>> =>
	token(tokenType ?? type(value) as any, value, findPos(input, value)) as any

/**
 * Quickly create a valid {@link Variable} .
 * Given the full string fed to the parser and the value for the variable returns a variable with the positions auto-filled.
 */
export const v = <T extends string>(
	input: string, value: T, opts: Parameters<typeof variable>["2"] = undefined, prefix?: Parameters<typeof variable>["0"],
): VariableNode =>
	variable(prefix, value, opts, findPos(input, value)) as any

/**
 * Quickly create an error {@link ValidToken}.
 *
 * Given the input, a string right before the error, and the expected token types, returns an error token.
 *
 */
export const e = <T extends string>(
	input: string, beforeError: string, expected: T[],
): ErrorToken => error<ExtractToken<T>>(findPos(input, beforeError).end, expected as any)

type ConditionConstructor = FirstParam<typeof createCondition>
export const nCondition = (
	property: string | undefined,
	value: ConditionConstructor["value"] = true,
	negate: ConditionConstructor["negate"] = false,
	operator: ConditionConstructor["operator"] = undefined,
 
) => createCondition({ property: property === undefined ? [] : property.split("."), operator, value, negate })

type ExpressionConstructor = FirstParam<typeof createExpression>
export const nExpression = (
	left: ExpressionConstructor["left"],
	operator: string,
	right: ExpressionConstructor["right"],
) => createExpression({ left, right, operator: operator === "&&" ? TOKEN_TYPE.AND : TOKEN_TYPE.OR })
