/**
 * The parser's methods are often long and have a lot of documentation per method, so it's methods have been split into mixins. They can be found in the `./methods` folder.
 *
 * Writing from within any of these methods is like writing a method from here except:
 * - `this` calls are wrapped in `(this as any as Parser<T>)`
 * - private method/property access requires `// @ts-expect-error`.
 * - recursion with hidden parameters requires re-typing this (see evaluate/validate for examples) since otherwise if we only retyped the function it would become unbound from `this`.
 *
 * Docs work like normal (on methods). From the outside, users of the library cannot even tell the class is composed of mixins.
 */

import { isWhitespace } from "@alanscodelog/utils/isWhitespace"
import { mixin } from "@alanscodelog/utils/mixin"
import type { Mixin } from "@alanscodelog/utils/types"
import { createSyntaxDiagramsCode, type ILexingResult, type Lexer } from "chevrotain"

import { token as tokenHandler } from "./ast/handlers.js"
import { createTokens } from "./grammar/createTokens.js"
import { ParserBase } from "./grammar/ParserBase.js"
import { BooleanParserLibraryError } from "./helpers/errors.js"
import { checkParserOpts } from "./helpers/parser/checkParserOpts.js"
import { getUnclosedRightParenCount } from "./helpers/parser/getUnclosedRightParenCount.js"
import { parseParserOptions, seal } from "./helpers/parser/index.js"
import { AutocompleteMixin } from "./methods/autocomplete.js"
import { AutoreplaceMixin } from "./methods/autoreplace.js"
import { Autosuggest } from "./methods/autosuggest.js"
import { EvaluateMixin } from "./methods/evaluate.js"
import { GetBestIndexesMixin } from "./methods/getBestIndex.js"
import { GetIndexMixin } from "./methods/getIndexes.js"
import { NormalizeMixin, ValidateMixin } from "./methods/index.js"
import type { ParserResults } from "./types/ast.js"
import { ERROR_CODES } from "./types/errors.js"
import type { FullParserOptions, ParserOptions } from "./types/parser.js"


/**
 * Creates the main parser class which handles all functionality (evaluation, validation, etc).
 */
export class Parser<T extends {} = {}> {
	options: FullParserOptions<T>

	private readonly rawOptions: ParserOptions<T>

	parser: ParserBase<T>

	private readonly lexer: Lexer

	private readonly tokens: ReturnType<typeof createTokens>["tokens"]

	info: ReturnType<typeof createTokens>["info"]

	constructor(options?: ParserOptions<T>) {
		this.rawOptions = options ?? {}
		const opts = parseParserOptions<T>(this.rawOptions)
		checkParserOpts<T>(opts)
		this.options = opts
		const { lexer, tokens, info } = createTokens<T>(opts)
		this.lexer = lexer
		this.tokens = tokens
		this.info = info
		this.parser = new ParserBase<T>(opts, this.tokens, this.info)
	}

	/**
	 * Parses a string.
	 */
	parse(input: string): ParserResults {
		if (isWhitespace(input)) {
			return tokenHandler.value(undefined, { start: 0, end: 0 }) as any
		}

		let lexed = this._lex(input)

		const shift = getUnclosedRightParenCount(lexed.tokens, this.tokens)
		if (shift) {
			input = "(".repeat(shift) + input
			lexed = this._lex(input)
		}
		this.parser.shift = shift
		this.parser.input = lexed.tokens
		this.parser.rawInput = input

		/**
		 * The parser can't handle unmatched right parens (i.e. left is missing) so we just insert them and shift the locations of all the tokens. Then the parser is designed to ignore parenthesis we added at the start and just return undefined for that rule as if the parenthesis didn't exist.
		 */
		try {
			if (lexed.errors.length > 0) throw new Error("Unexpected Lexer Errors")
			this.parser.input = lexed.tokens
			const res = this.parser.main()
			if (res === undefined) { throw new Error("throw") }
			// hidden param
			// eslint-disable-next-line prefer-rest-params
			if (!arguments[1]?.unsealed) seal(res)
			return res
		} catch (error: unknown) {
			// eslint-disable-next-line no-ex-assign
			if ((error as Error).message === "throw") error = undefined
			const err = new BooleanParserLibraryError(ERROR_CODES.PARSER_ERROR, {
				input,
				options: this.rawOptions,
				"parsed options": this.options,
				error: error as Error,
				"lexed tokens": lexed.tokens,
				"lexer errors": lexed.errors,
				"parser errors": this.parser.errors,
			})

			throw err
		}
	}

	// needed for evaluate and validate so they are only checked on demand
	private evaluationOptionsChecked: boolean = false

	// eslint-disable-next-line @typescript-eslint/naming-convention
	_checkEvaluationOptions(): void {
		if (!this.evaluationOptionsChecked) {
			checkParserOpts(this.options, true)
			this.evaluationOptionsChecked = true
		}
	}

	private validationOptionsChecked: boolean = false

	// eslint-disable-next-line @typescript-eslint/naming-convention
	_checkValidationOptions(): void {
		if (!this.validationOptionsChecked) {
			checkParserOpts(this.options, false, true)
			this.validationOptionsChecked = true
		}
	}

	/**
	 * Generates a railroad diagram for debugging. Does not 100% represent how things are actually handled internally.
	 *
	 * Not exposed because it uses the raw chevrotain tokens.
	 *
	 * **Note: It is not 100% accurate. Some special cases are parsed one way but handled internally differently.**
	 */
	private _generateRailRoadDiagram(): string {
		const serialized = this.parser.getSerializedGastProductions()
		const html = createSyntaxDiagramsCode(serialized)
		return html
	}

	/**
	 * For debugging.
	 * Not exposed because it returns the raw chevrotain tokens.
	 */
	private _lex(input: string): ILexingResult {
		return this.lexer.tokenize(input)
	}
}

export interface Parser<T extends {} = {}> extends Mixin<
	| AutocompleteMixin<T>
	| AutoreplaceMixin
	| Autosuggest<T>
	| EvaluateMixin<T>
	| ValidateMixin<T>
	| NormalizeMixin<T>
	| GetIndexMixin<T>
	| GetBestIndexesMixin
>,
	AutocompleteMixin<T>,
	AutoreplaceMixin,
	Autosuggest<T>,
	EvaluateMixin<T>,
	ValidateMixin < T >,
	NormalizeMixin<T>,
	GetIndexMixin<T>,
	GetBestIndexesMixin
{}

mixin(Parser, [
	AutocompleteMixin,
	AutoreplaceMixin,
	Autosuggest,
	EvaluateMixin,
	ValidateMixin,
	NormalizeMixin,
	GetIndexMixin,
	GetBestIndexesMixin,
])
