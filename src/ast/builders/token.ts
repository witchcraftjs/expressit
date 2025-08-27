import { isArray } from "@alanscodelog/utils/isArray"

import { pos } from "./pos.js"

import type { AnyToken, EmptyObj, ErrorToken, Position, TokenType, ValidToken } from "../../types/ast.js"
import { createToken } from "../createToken.js"


/**
 * Creates a {@link ValidToken} or of the given type with the given value. If no value is given, creates an {@link ErrorToken} instead.
 *
 * Can be passed multiple types when creating an error token to set the expected field.
 *
 * If the token is an error token, just `start` or `end` can be passed, and the other position will be filled to the same value.
 */

export function token<
	TValue extends string | undefined,
	TType extends TokenType = TokenType,
>(
	type: TValue extends undefined ? TType | TType[] : TType,
	value: TValue,
	position: Position | Partial<Position> | EmptyObj = {},
): TValue extends undefined
	? ErrorToken
	: ValidToken<TType> {
	position = pos(position, { fill: true })
	// eslint-disable-next-line @typescript-eslint/no-shadow
	let token: AnyToken<TType>
	if (value !== undefined) {
		token = createToken({
			type: type as TType,
			value,
			start: position.start!,
			end: position.end!,
		})
	} else {
		token = createToken({
			expected: (isArray(type) ? type : [type]) as TType[],
			start: position.start!,
			end: position.end!,
		})
	}
	return token as any
}
