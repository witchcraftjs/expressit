import { isArray } from "@alanscodelog/utils"

import { pos } from "./pos.js"

import type { AnyToken, EmptyObj, Position, TOKEN_TYPE } from "../../types/ast.js"
import { ErrorToken } from "../classes/ErrorToken.js"
import { ValidToken } from "../classes/ValidToken.js"


/**
 * Creates a @see ValidToken or of the given type with the given value. If no value is given, creates an @see ErrorToken instead.
 *
 * Can be passed multiple types when creating an error token to set the expected field.
 *
 * If the token is an error token, just `start` or `end` can be passed, and the other position will be filled to the same value.
 */

export function token<
	TValue extends string | undefined,
	TType extends TOKEN_TYPE = TOKEN_TYPE,
>(
	type: TValue extends undefined ? TType | TType[] : TType,
	value: TValue,
	position: Position | Partial<Position> | EmptyObj = {}
): TValue extends undefined
	? ErrorToken<TType>
	: ValidToken<TType> {
	position = pos(position, { fill: true })
	// eslint-disable-next-line @typescript-eslint/no-shadow
	let token: AnyToken<TType>
	if (value !== undefined) {
		token = new ValidToken<TType>({
			type: type as TType,
			value,
			start: position.start!,
			end: position.end!,
		})
	} else {
		token = new ErrorToken<TType>({
			expected: (isArray(type) ? type : [type]) as TType[],
			start: position.start!,
			end: position.end!,
		})
	}
	return token as any
}
