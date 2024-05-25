import type { ParserOptions } from "./parser.js"


export enum ERROR_CODES {
	PARSER_POSITION_ERROR = "PARSER.POSITION",
	PARSER_CONFLICTING_OPTIONS_ERROR = "PARSER.OPTIONS.CONFLICTING",
	PARSER_OPTION_REQUIRED_ERROR = "PARSER.OPTIONS.CUSTOM_REQUIRED",
}


export type ErrorInfo<T extends ERROR_CODES> =
	T extends ERROR_CODES
	? ERROR_Info[T]
	: never

// eslint-disable-next-line @typescript-eslint/naming-convention
export type ERROR_Info = {
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
