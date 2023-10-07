import { type AnyToken, TOKEN_TYPE, type TokenParenTypes } from "../types/ast.js"


export function isParen(token?: AnyToken): token is AnyToken<TokenParenTypes> {
	return ([TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR] as any[]).includes(token?.type)
}
