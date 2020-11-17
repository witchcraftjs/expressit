import { type } from "./type"

import { ErrorToken } from "@/ast/classes"
import { TOKEN_TYPE } from "@/types"


/**
 * Creates an error token.
 *
 * @param expected Can be passed an array of @see ValidToken_TYPE or strings, in which case it will use @see type internally. So instead of `[TOKEN_TYPE.VALUE]` we can do `[""]` and instead of `[TOKEN_TYPE.PARENR]` we can do `[")"]`.
 */
export function error<T extends TOKEN_TYPE>(pos: number, expected: T[]): ErrorToken<T>
export function error<T extends TOKEN_TYPE>(pos: number, expected_: T[]): ErrorToken<T> {
	const expected = expected_.map(item => {
		if (TOKEN_TYPE[item as keyof typeof TOKEN_TYPE] === undefined) {
			return type(item)
		} else {
			return item
		}
	}) as T []
	return new ErrorToken({ expected, start: pos, end: pos })
}
