import { type ExtractToken, TOKEN_TYPE } from "../../types/ast.js"
/**
 * Given a the string value of an operator or single delimiter token, returns the corresponding {@link ValidToken_TYPE} .
 */
export function type<T extends string>(
	operatorSymbol: T,
): ExtractToken<T> {
	switch (operatorSymbol) {
		case "`": return TOKEN_TYPE.BACKTICK as any
		case `'`: return TOKEN_TYPE.SINGLEQUOTE as any
		case `"`: return TOKEN_TYPE.DOUBLEQUOTE as any
		case `(`: return TOKEN_TYPE.PARENL as any
		case `)`: return TOKEN_TYPE.PARENR as any
		case `[`: return TOKEN_TYPE.BRACKETL as any
		case `]`: return TOKEN_TYPE.BRACKETR as any
		case `/`: return TOKEN_TYPE.REGEX as any
		case `and`:
		case `&&`:
		case `&`:
			return TOKEN_TYPE.AND as any
		case `or`:
		case `||`:
		case `|`:
			return TOKEN_TYPE.OR as any
		case `not`:
		case `!`:
			return TOKEN_TYPE.NOT as any
		default:
			return TOKEN_TYPE.VALUE as any
	}
}

