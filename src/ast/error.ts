import { createToken } from "./createToken.js"

import { type ErrorToken,type TokenType } from "../types/ast.js"

export function error<T extends TokenType>(pos: number, expected: T[]): ErrorToken {
	if (pos === undefined) throw new Error("should never happen, passed undefined position for error token")
	return createToken({ expected, start: pos, end: pos })
}

