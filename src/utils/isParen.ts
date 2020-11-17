import { AnyToken, TOKEN_TYPE, TokenParenTypes } from "@/types"


export function isParen(token?: AnyToken): token is AnyToken<TokenParenTypes> {
	return ([TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR] as any[]).includes(token?.type)
}
