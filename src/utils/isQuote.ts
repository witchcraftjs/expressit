import { type AnyToken, TOKEN_TYPE, type TokenQuoteTypes } from "../types/ast.js"

/** Returns if the token is a quote token. This includes regex delimiters. */
export function isQuote(token?: AnyToken): token is AnyToken<TokenQuoteTypes> {
	return ([TOKEN_TYPE.BACKTICK, TOKEN_TYPE.DOUBLEQUOTE, TOKEN_TYPE.SINGLEQUOTE, TOKEN_TYPE.REGEX] as any[]).includes(token?.type)
}
