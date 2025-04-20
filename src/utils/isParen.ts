import { type AnyToken, TOKEN_TYPE, type TokenParen } from "../types/ast.js"


export function isParen(token?: AnyToken): token is AnyToken<TokenParen> {
	return ([TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR] as any[]).includes(token?.type)
}
