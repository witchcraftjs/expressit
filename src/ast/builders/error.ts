import { type } from "./type.js"

import { type ErrorToken,TOKEN_TYPE } from "../../types/ast.js"
import { createToken } from "../createToken.js"


/**
 * Creates an error token.
 *
 * @param expected Can be passed an array of {@link ValidToken_TYPE} or strings, in which case it will use {@link type} internally. So instead of `[TOKEN_TYPE.VALUE]` we can do `[""]` and instead of `[TOKEN_TYPE.PARENR]` we can do `[")"]`.
 */
export function error<T extends TOKEN_TYPE>(pos: number, expected: T[]): ErrorToken
export function error<T extends TOKEN_TYPE>(pos: number, expected_: T[]): ErrorToken {
	const expected = expected_.map(item => {
		if (TOKEN_TYPE[item as keyof typeof TOKEN_TYPE] === undefined) {
			return type(item)
		} else {
			return item
		}
	}) as T []
	return createToken({
		expected,
		start: pos,
		end: pos
	})
}
