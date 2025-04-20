import { type EnumLike } from "@alanscodelog/utils"
import { enumFromArray } from "@alanscodelog/utils/enumFromArray.js"

import type { ParserOptions } from "./parser.js"


export const PARSER_ERROR = enumFromArray([
	"POSITION_ERROR",
	"CONFLICTING_OPTIONS_ERROR",
	"OPTION_REQUIRED_ERROR",
], "PARSER.")

export type ParserError = EnumLike<typeof PARSER_ERROR>


export type ErrorInfo<T extends ParserError> =
	T extends ParserError
	? ErrorCodesInfo[T]
	: never

 
export type ErrorCodesInfo = {
	[PARSER_ERROR.POSITION_ERROR]: {
		start?: number
		end?: number
	}
	[PARSER_ERROR.CONFLICTING_OPTIONS_ERROR]: {
		prohibited: string[]
		invalid: string
	}
	[PARSER_ERROR.OPTION_REQUIRED_ERROR]: {
		options?: (keyof ParserOptions)[]
		requires: keyof ParserOptions
	}
}
