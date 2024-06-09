import { ExpressitError } from "../internal/ExpressitError.js"
import type { ErrorToken, RawToken, TOKEN_TYPE, ValidToken } from "../types/ast.js"
import { ERROR_CODES } from "../types/errors.js"

export function createToken<
	TType extends TOKEN_TYPE,
>(raw: { type: TType } & RawToken<ValidToken>): ValidToken<TType>
export function createToken(raw: RawToken<ErrorToken>): ErrorToken
export function createToken<
	TValid extends boolean = boolean,
	TType extends
		TValid extends true ? TOKEN_TYPE : never =
		TValid extends true ? TOKEN_TYPE : never,
>(raw: RawToken<ValidToken> | RawToken<ErrorToken>): TValid extends true
? ValidToken<TType>
: ErrorToken {
	if (raw.start === undefined || raw.end === undefined) {
		throw new ExpressitError(ERROR_CODES.PARSER_POSITION_ERROR, raw)
	}
	return {
		...raw,
		valid: typeof (raw as any).expected === "undefined",
		isToken: true,
	} as any
}

