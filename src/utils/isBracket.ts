import { type AnyToken, TOKEN_TYPE, type TokenBracketTypes } from "../types/ast.js"


export function isBracket(token?: AnyToken): token is AnyToken<TokenBracketTypes> {
	return ([TOKEN_TYPE.BRACKETL, TOKEN_TYPE.BRACKETR] as any[]).includes(token?.type)
}
