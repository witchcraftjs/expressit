import { type AnyToken, TOKEN_TYPE, type TokenDelimiter } from "../types/ast.js"

/**
 * Returns whether token is a delimiter type (including if it's an expanded operator separator).
 */
export function isDelimiter(token?: AnyToken): token is AnyToken<TokenDelimiter> {
	return ([
		TOKEN_TYPE.BACKTICK,
		TOKEN_TYPE.DOUBLEQUOTE,
		TOKEN_TYPE.SINGLEQUOTE,
		TOKEN_TYPE.PARENL,
		TOKEN_TYPE.PARENR,
		TOKEN_TYPE.BRACKETL,
		TOKEN_TYPE.BRACKETR,
		TOKEN_TYPE.OP_EXPANDED_SEP,
		TOKEN_TYPE.REGEX,
	] as TokenDelimiter[]).includes(token?.type as TokenDelimiter)
}
