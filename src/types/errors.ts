import type { DeepPartial } from "@alanscodelog/utils/types"
import type { ILexingError, IRecognitionException, IToken } from "chevrotain"

import type { ParserOptions } from "./parser.js"


export enum ERROR_CODES {
	"PARSER_ERROR" = "PARSER.ERROR",
	"PARSER_POSITION_ERROR" = "PARSER.POSITION",
	"PARSER_CONFLICTING_OPTIONS_ERROR" = "PARSER.OPTIONS.CONFLICTING",
	"PARSER_OPTION_REQUIRED_ERROR" = "PARSER.OPTIONS.CUSTOM_REQUIRED",
}
export type ErrorInfo<T extends keyof ErrorInfos> = ErrorInfos[T]
export type ErrorInfos = {
	[ERROR_CODES.PARSER_ERROR]: {
		input: string
		options: DeepPartial<ParserOptions> | undefined
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"parsed options": ParserOptions
		error: Error
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"lexer errors": ILexingError[]
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"lexed tokens": IToken[]
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"parser errors": IRecognitionException[]
	}
	[ERROR_CODES.PARSER_POSITION_ERROR]: {
		start?: number
		end?: number
	}
	[ERROR_CODES.PARSER_CONFLICTING_OPTIONS_ERROR]: {
		prohibited: string[]
		invalid: string
	}
	[ERROR_CODES.PARSER_OPTION_REQUIRED_ERROR]: {
		options?: (keyof ParserOptions)[]
		requires: keyof ParserOptions
	}
}
