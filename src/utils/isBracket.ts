import { AnyToken, TOKEN_TYPE, TokenBracketTypes } from "@/types"


export function isBracket(token?: AnyToken): token is AnyToken<TokenBracketTypes> {
	return ([TOKEN_TYPE.BRACKETL, TOKEN_TYPE.BRACKETR] as any[]).includes(token?.type)
}
