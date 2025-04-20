import { ExpressitError } from "../internal/ExpressitError.js"
import type { ErrorToken, RawToken, TokenType, ValidToken } from "../types/ast.js"
import { PARSER_ERROR } from "../types/errors.js"

export function createToken<
	TType extends TokenType,
>(raw: { type: TType } & RawToken<ValidToken>): ValidToken<TType>
export function createToken(raw: RawToken<ErrorToken>): ErrorToken
export function createToken<
	TValid extends boolean = boolean,
	TType extends
		TValid extends true ? TokenType : never =
		TValid extends true ? TokenType : never
>(raw: RawToken<ValidToken> | RawToken<ErrorToken>): TValid extends true
? ValidToken<TType>
: ErrorToken {
	if (raw.start === undefined || raw.end === undefined) {
		throw new ExpressitError(PARSER_ERROR.POSITION_ERROR, raw)
	}
	return {
		...raw,
		valid: typeof (raw as any).expected === "undefined",
		isToken: true,
	} as any
}

