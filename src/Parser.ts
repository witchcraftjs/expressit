import { isArray } from "@alanscodelog/utils/isArray"
import { isWhitespace } from "@alanscodelog/utils/isWhitespace"
import { mixin } from "@alanscodelog/utils/mixin"
import { setReadOnly } from "@alanscodelog/utils/setReadOnly"
import type { AddParameters, Mixin } from "@alanscodelog/utils/types"
import { unreachable } from "@alanscodelog/utils/unreachable"

import { pos } from "./ast/builders/pos.js"
import { ArrayNode } from "./ast/classes/ArrayNode.js"
import { ConditionNode } from "./ast/classes/ConditionNode.js"
import { ErrorToken } from "./ast/classes/ErrorToken.js"
import { ExpressionNode } from "./ast/classes/ExpressionNode.js"
import { GroupNode } from "./ast/classes/GroupNode.js"
import type { ValidToken } from "./ast/classes/ValidToken.js"
import { VariableNode } from "./ast/classes/VariableNode.js"
import * as handle from "./ast/handlers.js"
import { checkParserOpts } from "./helpers/parser/checkParserOpts.js"
import { extractPosition } from "./helpers/parser/extractPosition.js"
import { getUnclosedRightParenCount } from "./helpers/parser/getUnclosedRightParenCount.js"
import { parseParserOptions } from "./helpers/parser/parseParserOptions.js"
import { seal } from "./helpers/parser/seal.js"
import { $C, $T, Lexer,type RealTokenType, type Token, type TokenCategoryType, type TokenType } from "./Lexer.js"
import { AutocompleteMixin } from "./methods/autocomplete.js"
import { AutoreplaceMixin } from "./methods/autoreplace.js"
import { Autosuggest } from "./methods/autosuggest.js"
import { EvaluateMixin } from "./methods/evaluate.js"
import { GetBestIndexesMixin } from "./methods/getBestIndex.js"
import { GetIndexMixin } from "./methods/getIndexes.js"
import { NormalizeMixin } from "./methods/normalize.js"
import { ValidateMixin } from "./methods/validate.js"
import type { ParserResults } from "./types/ast.js"
import { type AnyToken, type Position, TOKEN_TYPE } from "./types/index.js"
import type { FullParserOptions, ParserOptions } from "./types/parser.js"

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


/**
 * Creates the main parser class which handles all functionality (evaluation, validation, etc).
 */
export class Parser<T extends {} = {}> {
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

	options: FullParserOptions<T>

	private readonly lexer: Lexer

	private readonly $: Record<$T, RealTokenType<$T>>

	private readonly $categories: Partial<Record<$C, TokenCategoryType<$C>>>

	private readonly info: Pick<ReturnType<Lexer["calculateSymbolInfo"]>, "expandedSepAlsoCustom" | "customOpAlsoNegation">

	constructor(options?: ParserOptions<T>) {
		const opts = parseParserOptions<T>(options ?? {})
		checkParserOpts<T>(opts)
		this.options = opts
		this.lexer = new Lexer(opts)
		this.$ = this.lexer.$
		this.$categories = this.lexer.$categories
		this.info = {
			expandedSepAlsoCustom: this.lexer.symbols.expandedSepAlsoCustom,
			customOpAlsoNegation: this.lexer.symbols.customOpAlsoNegation,
		}
	}

	state: {
		rawInput: string
		lexedTokens: Token<$T>[]
		index: number
		shift: number
	} = {
			rawInput: "",
			lexedTokens: [],
			index: 0,
			shift: 0,
		}

	/**
	 * This is exposed mainly for debugging purposes. Use parse directly instead.
	 */
	lex(input: string): {
		tokens: Token<$T> []
		shift: number
		rawInput: string
	} {
		if (isWhitespace(input)) {
			return { tokens: [], shift: 0, rawInput: input }
		}
		let lexed = this.lexer.tokenize(input)
		/**
		 * The parser can't handle unmatched right parens (i.e. left is missing) so we just insert them and shift the locations of all the tokens. Then the parser is designed to ignore parenthesis we added at the start and just return undefined for that rule as if the parenthesis didn't exist.
		 */


		const shift = getUnclosedRightParenCount(lexed)
		const rawInput = input
		if (shift) {
			input = "(".repeat(shift) + input
			lexed = this.lexer.tokenize(input)
		}
		const lexedTokens = lexed.filter(token => {
			const tokenType = this.getTokenType(token.type)
			if (tokenType) {
				return !tokenType.skip
			} else {
				throw new Error(`Unknown token type ${token.type}`)
			}
		})
		return { tokens: lexedTokens, shift, rawInput }
	}

	/**
	 * Parse an input string into an AST.
	 * It can also parse the result from `lex`, but that is really only for internal use.
	 */
	parse(
		input: string
		| {
			tokens: Token<$T> []
			shift: number
			rawInput: string
		},
	): ParserResults {
		// eslint-disable-next-line prefer-rest-params
		const doSeal = arguments[1]?.seal ?? true
		if (typeof input === "string" && isWhitespace(input)) {
			return handle.token.value(undefined, { start: 0, end: 0 }) as any
		}
		const { tokens: lexedTokens, shift, rawInput } = typeof input === "string" ? this.lex(input) : input
		
		this.state = {
			rawInput,
			shift,
			index: -1,
			lexedTokens,
		}
		const res = this.ruleMain()
		if (doSeal) {
			seal(res)
		}
		this.state = {
			rawInput: "",
			shift: 0,
			index: -1,
			lexedTokens: [],
		}
		return res
	}

	subParserOne?: Parser<T> & {
		parse: AddParameters<Parser<T>["parse"], [{ seal: boolean }]>
	}

	subParserTwo?: Parser<T> & {
		parse: AddParameters<Parser<T>["parse"], [{ seal: boolean }]>
	}


	createSubParserIfNotExists(opts: ParserOptions<T>, which: "One" | "Two" = "One"): Parser["subParserOne"] {
		if (this[`subParser${which}`] === undefined) {
			this[`subParser${which}`] = new Parser(opts)
		}
		return this[`subParser${which}`]!
	}
	
	
	transformCategoryToken<TC extends $C>(
		token: Token,
		categoryToken: TokenCategoryType<TC>,
	): Token<TC> {
		return {
			...token,
			type: categoryToken.type,
		}
	}

	getCategoryTokens<TType extends $C>(
		type: TType,
	): TokenCategoryType<TType>["entries"] | undefined {
		return this.$categories[type as $C]?.entries as any
	}

	getTokenType(type: $T | $C): TokenType<$T> | undefined {
		return this.$[type as any as $T] as any
	}

	isExactType<TType extends $T>(token: Token, type: TType): token is Token<TType> {
		if (this.$[type]) {
			return this.isType(token, type)
		}
		return false
	}

	isType(token: Token | undefined, type: $T | $C): boolean {
		if (token === undefined) return false
		if (token.type === type) return true
		const tokenType = this.getTokenType(token.type)
		
		if (tokenType?.type === type) return true
		const category = this.$categories[type as $C]
		if (category?.entries[token.type as $T] !== undefined) {
			return true
		}
		return false
	}

	createErrorToken(type: $T, index?: number): Token {
		return {
			type,
			value: "",
			startOffset: index ?? this.state.index,
			endOffset: index ?? this.state.index,
			isError: true,
		}
	}

	processToken<TDefined extends boolean = boolean>(token?: Pick<Token, "value" | "startOffset" | "endOffset">): [TDefined extends true ? string : string | undefined, Position] {
		if (token === undefined) {
			return [undefined as any, extractPosition({ startOffset: 0, endOffset: 0 }, this.state.shift)]
		} else {
			return [token.value, extractPosition(token, this.state.shift)]
		}
	}
	

	peek(n = 1): Token<$T> | undefined {
		return this.state.lexedTokens[this.state.index + n]
	}

	nextIsEof(): boolean {
		return this.peek(1) === undefined
	}

	consumeAny(): Token<$T> {
		return this.consume(this.peek(1)?.type)
	}

	consume<
		TType extends $T | $C,
	>(
		type: TType | undefined,
	): Token<TType> {
		if (type === undefined) {
			throw new Error("type is undefined")
		}
		const nextToken = this.peek(1)
		if (nextToken === undefined) {
			throw new Error(`Reached end of input without consuming a token of type ${type}`)
		}
		if (this.$categories[type as $C] !== undefined) {
			const categoryToken = this.$categories[type as $C]
			const tokenType = categoryToken?.entries[nextToken.type as $T]
			if (categoryToken && tokenType) {
				this.state.index++
				return this.transformCategoryToken(nextToken, categoryToken) as Token<TType>
			} else {
				throw new Error("here")
			}
		} else {
			const tokenType = this.getTokenType(type as $T)
			if (tokenType !== undefined) {
				if (nextToken?.type === tokenType.type) {
					this.state.index++
					return nextToken as any
				} else {
					throw new Error(`Expected token type ${tokenType.type}, got ${nextToken?.type}`)
				}
			}
		}
		throw new Error(`Unknown token type ${type}`)
	}

	saveState(): Parser["state"] {
		return { ...this.state }
	}

	restoreState(state: Parser["state"]): void {
		this.state = state // careful, we assume this is an untouched copy
	}

	ruleMain(): ParserResults {
		const res = this.ruleBool("OR")
		if (res === undefined) {
			const error = handle.token.value(undefined, { start: 0, end: 0 })
			return error
		}
		return res
	}
	
	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	ruleBool<TType extends"AND" | "OR">(type: TType) {
		const OP_TYPE = type === "AND" ? $C.OPERATOR_AND : $C.OPERATOR_OR

		const pairs: any[][] = [] as any
		let next = this.peek(1)

		while (pairs.length < 1 || pairs[pairs.length - 1]?.[1] !== undefined) {
			const exp = type === "AND" ? this.ruleCondition() : this.ruleBool("AND")
			next = this.peek(1)
			const canAttemptErrorRecovery = type === "AND"
				? ["error", "and"].includes(this.options.onMissingBooleanOperator)
				: this.options.onMissingBooleanOperator === "or"
			const extras: any[] = []
			if (
				canAttemptErrorRecovery
				&& (
					this.isType(next, $C.VALUE)
				|| this.isType(next, $C.QUOTE_ANY)
				|| this.isType(next, $T.PAREN_L)
				|| this.isType(next, $T.EXP_PROP_OP)
				|| this.isType(next, $T.REGEX_START)
				|| this.isType(next, $T.CUSTOM_PROP_OP)
				)
			) {
				let state = this.saveState()
				let cond = this.ruleCondition()
				if (type === "AND") {
					let dummyOp
					while (cond !== undefined) {
						if (this.options.onMissingBooleanOperator === "and") {
							// the operator is missing between the previous token and this exp
							const prev = this.peek(-1)!
							const start = prev.endOffset! + 1
							dummyOp = handle.operator.and("", pos({ start }, { fill: true }))
						}
						extras.push([dummyOp, cond])
						state = this.saveState()
						cond = this.ruleCondition()
					}
					// todo i don't think we need to backtrack
					this.restoreState(state)
				} else {
					// the operator is missing between the previous token and this exp
					const prev = this.peek(-1)!
					const start = prev.endOffset! + 1
					const dummyOp = handle.operator.or("", pos({ start }, { fill: true }))
					extras.push([dummyOp, cond])
				}
				next = this.peek(1)
			}
			const sepToken = this.isType(next, OP_TYPE) && next
				? type === "AND"
					? handle.operator.and(...this.processToken<true>(this.consume(next.type)))
					: handle.operator.or(...this.processToken<true>(this.consume(next.type)))
				: undefined

			pairs.push([
				exp,
				sepToken,
			])
			next = this.peek(1)
			for (const extra of extras) {
				pairs[pairs.length - 1].splice(1, 1, extra[0])
				pairs.push([extra[1]])
			}
		}

		if (pairs.length === 0 && this.isType(this.peek(1), OP_TYPE)) {
			next = this.peek(-1)
			let state = this.saveState()
			while (this.isType(next, $C.OPERATOR_AND)) {
				const token = this.consume($C.OPERATOR_AND)
				pairs.push([
					undefined,
					type === "AND"
						? handle.operator.and(...this.processToken<true>(token))
						: handle.operator.or(...this.processToken<true>(token)),
				])
				next = this.peek(-1)
				while (this.isType(next, $C.VALUE) || this.isType(next, $C.QUOTE_ANY) || this.isType(next, $T.PAREN_L)) {
					pairs.push([this.ruleCondition()])
					next = this.peek(-1)
				}
				state = this.saveState()
			}
			this.restoreState(state)
		}

		if (type === "AND" && pairs.length === 0) return undefined
		// handle situations like `a ||` where b is missing
		let res = pairs[pairs.length - 1][0]
		for (let i = pairs.length - 1; i > 0; i--) {
			const before = pairs[i - 1]
			if (type === "OR" && res === undefined && before === undefined) return undefined
			res = handle.expression(before[0], before[1], res)
		}
		return res
	}

	ruleCondition(): ConditionNode | GroupNode | ConditionNode<boolean> | undefined {
		const not = this.ruleNot()
		const property = this.ruleConditionProperty()
		const propVal = property?.prop?.value === undefined
			? undefined
			: property.prop.value instanceof ErrorToken
				? ""
				: property.prop.value.value

		const propOpVal = property?.rest?.propertyOperator === undefined
			? undefined
			: property.rest.propertyOperator instanceof ErrorToken
				? ""
				: property.rest.propertyOperator?.value


		const isExpanded = (property?.rest?.sepL ?? property?.rest?.sepR) !== undefined

		const convertRegexValues = typeof this.options.regexValues === "function"
		&& !this.options.regexValues(propVal, propOpVal, isExpanded)

		const convertArrayValues = typeof this.options.arrayValues === "function"
		&& !this.options.arrayValues(propVal, propOpVal, isExpanded)
		
		let value = this.ruleConditionValue(property, { convertRegexValues, convertArrayValues })
		
		let group
		if (!(value instanceof ArrayNode)
			&& !isArray(value)
			&& (!value || this.options.prefixableGroups)
			&& this.isType(this.peek(1), $T.PAREN_L) // is not already plain group
		) {
			group = this.rulePlainGroup({ onlyValues: property !== undefined, convertRegexValues, convertArrayValues })
		}
		
		if (isArray(value)) {
			group = value
			value = undefined
		}
		if (convertRegexValues && value instanceof VariableNode && value.quote?.left.type === TOKEN_TYPE.REGEX) {
			value = handle.variable(undefined, undefined, handle.token.value(
				(value.quote?.left?.value ?? "") + (value.value.value ?? "") + (value.quote?.right?.value ?? ""),
				pos(value),
			), undefined) as ReturnType<Parser["ruleVariable"]>
		}
		if (group) {
			if (property) {
				return handle.condition(not, property?.prop, property?.rest, handle.group(undefined, undefined, ...group))
			}
			if (value) {
				return handle.group(undefined, handle.condition(not, undefined, undefined, value), ...group)
			}
			return handle.group(not, value, ...group)
		}
		if ([not, property, value].every(_ => _ === undefined)) return undefined
		
		return handle.condition(not, property?.prop, property?.rest, value as any)
	}

	ruleConditionValue(
		property: ReturnType<Parser<T>["ruleConditionProperty"]>,
		{ convertRegexValues = false, convertArrayValues = false }:
		{ convertRegexValues?: boolean, convertArrayValues?: boolean } = {},
	): ReturnType<Parser["rulePlainGroup"]>
		| ReturnType<Parser["rulePlainBracketGroup"]>
		| ReturnType<Parser["ruleVariable"]>
		| undefined
	{
		const next = this.peek(1)
		const next2 = this.peek(2)
		const next3 = this.peek(3)
		const next4 = this.peek(4)
		if (this.options.prefixableGroups
			&& property === undefined
			&& next?.type !== $T.PAREN_L // moves to parsing group below instead
			&& (
				(
					this.isType(next, $C.VALUE)
						&& (
							this.isType(next2, $T.PAREN_L) // a(
							|| (this.isType(next2, $C.QUOTE_ANY) && this.isType(next3, $T.PAREN_L)) // a"(
						)
				)
					|| (
						this.isType(next, $C.QUOTE_ANY)
						&& (
							this.isType(next2, $T.PAREN_L) // "(
							|| (this.isType(next2, $C.VALUE)
							&& (
								this.isType(next3, $T.PAREN_L) || // "a(
									(this.isType(next3, $C.QUOTE_ANY) && this.isType(next4, $T.PAREN_L)) // "a"(
							)
							)
						)
					)
			)
		) {
			const res = this.ruleVariable({ unprefixed: true })
			if (res) return res
		}
		if (!this.isType(next, $T.PAREN_L)) {
			const res = this.ruleVariable({ unprefixed: false })
			if (res) return res
		}
		if (this.isType(next, $T.PAREN_L)) {
			const res = this.rulePlainGroup({ onlyValues: property !== undefined, convertRegexValues, convertArrayValues })
			if (res) return res
		}
		if (this.isType(next, $T.BRACKET_L)) {
			const res = this.rulePlainBracketGroup({ convertArrayValues })
			if (res) return res
		}
		return undefined
	}

	rulePlainGroup(
		{ onlyValues = false, convertRegexValues = false, convertArrayValues = false }:
		{ onlyValues?: boolean, convertRegexValues?: boolean, convertArrayValues?: boolean } = {},
	): [
			ValidToken<TOKEN_TYPE.PARENL> | undefined,
			GroupNode["expression"],
		ValidToken<TOKEN_TYPE.PARENR> | undefined,
		] {
		const parenL = this.ruleParenL()
		let parenLeftCount = 0
		let start: undefined | number
		let end: undefined | number
		const condition = !onlyValues ? this.ruleBool("OR") : undefined
			
		/**
			* The following a bit of a hack to ignore forbidden expressions in groups when used as values (it would make no sense to do something like `prop:op(prop:op(...)))` or `prop:op:(prefix(...))`).
			*
			* Doing this from the tokenizer is very complicated because it would require keeping track of a lot of state since we need to know when a group follows something that even looks like a property/operator. Doing it from the parser is possible, but it would involve ignoring lots of token types and converting them.
			*
			* This way we just consume all input until the correct next matching paren (or EOF) and re-parse it with a restricted version of the parser, which is easier to understand.
			*
			* Performance wise this should not be a problem since at most we add the time of one initialization per Parser/ParserBase class instance and only on demand. After that the parser is re-used when needed for any future parse calls. Additionally it only needs to be called once for the outer group used in a property value (i.e. `prop:OP:((()))` will only cause a single "sub parse").
			*/

		if (onlyValues && !this.nextIsEof()) {
			while (
				!this.nextIsEof()
				&& (!this.isType(this.peek(1), $T.PAREN_R) || parenLeftCount !== 0)
			) {
				const token = this.consumeAny()
				start ??= extractPosition(token, this.state.shift).start
				if (token.type === $T.PAREN_L) {
					parenLeftCount++
				}
				if (token.type === $T.PAREN_R) {
					parenLeftCount--
				}
			}
		}

		if (start !== undefined) {
			end ??= extractPosition(this.peek(0)!, this.state.shift).end
		}
		const parenR = this.isType(this.peek(1), $T.PAREN_R) ? this.ruleParenR() : undefined
		if (start !== undefined) {
			const subInput = this.state.rawInput.slice(start, end)
			this.createSubParserIfNotExists({
				...this.options,
				customPropertyOperators: [],
				expandedPropertySeparator: undefined,
				regexValues: convertRegexValues,
				arrayValues: convertArrayValues,
			}, "One")
			const parsed = this.subParserOne!.parse(" ".repeat(start) + subInput, { seal: false })
			return [parenL, parsed, parenR]
		}
		return [parenL, condition, parenR]
	}

	rulePlainBracketGroup(
		{ convertArrayValues = false }:
		{ convertArrayValues?: boolean } = {},
	): ArrayNode | VariableNode {
		const bracketL = this.ruleBracketL()
		
		const values: any[] = []
				
		if (!convertArrayValues) {
			let state = this.saveState()
			let variable = this.ruleVariable({ unprefixed: false })
			while (variable !== undefined) {
				values.push(variable)
				state = this.saveState()
				variable = this.ruleVariable({ unprefixed: false })
			}
			this.restoreState(state)
		} else if (convertArrayValues && !this.nextIsEof()) {
			while (
				!this.nextIsEof()
					&& !this.isType(this.peek(1), $T.BRACKET_R)
			) {
				this.consumeAny()
			}
		}
		const bracketR = this.isType(this.peek(1), $T.BRACKET_R) ? this.ruleBracketR() : undefined
		if (bracketL === undefined) throw new Error("bracketL is undefined, peek before using rule.")
		if (!convertArrayValues) {
			return handle.array(bracketL, values, bracketR)
		}
		const start = bracketL.start
		const end = bracketR?.end
		/**
		 * Similar problem as with plain groups above.
		 */
		const subInput = this.state.rawInput.slice(start, end)
		this.createSubParserIfNotExists({
			...this.options,
			customPropertyOperators: [],
			expandedPropertySeparator: undefined,
			arrayValues: false,
		}, "Two")
		const parsed = this.subParserTwo!.parse(" ".repeat(start) + subInput, { seal: false })
		if (parsed instanceof ConditionNode) {
			return parsed.value as ArrayNode
		}
		if (parsed instanceof ErrorToken || parsed instanceof ExpressionNode || parsed instanceof GroupNode) {
			unreachable("parsed.value should not be an ErrorToken, ExpressionNode, or GroupNode.")
		}
		return parsed
	}

	ruleConditionProperty(): {
		prop?: VariableNode
		rest: Parameters<typeof handle.condition>[2]
	} | undefined {
		const current = this.peek(0)
		const next = this.peek(1)
		const next2 = this.peek(2)
		if (this.isType(next, $T.EXP_PROP_OP)
		|| this.isType(next, $T.CUSTOM_PROP_OP)
		|| (this.isType(next, $T.VALUE_UNQUOTED) && (
			this.isType(next2, $T.EXP_PROP_OP)
			|| this.isType(next2, $T.CUSTOM_PROP_OP)
		))
		|| (
			this.info.customOpAlsoNegation
			&& (
				this.isType(next2, $T.SYM_NOT)
				|| (this.isType(current, $T.SYM_NOT) && this.isType(next, $T.SYM_NOT))
			)
		)
		) {
			return this.ruleProperty()
		}
		return undefined
	}

	ruleProperty(): {
		prop?: VariableNode
		rest: Parameters<typeof handle.condition>[2]
	} {
		const prop = this.ruleVariable({ unprefixed: true })
		const next = this.peek(1)
		let rest: Parameters<typeof handle.condition>[2] = {} as any
		if (this.isType(next, $T.EXP_PROP_OP)) {
			const sepL = handle.token.sep(...this.processToken<true>(this.consume($T.EXP_PROP_OP)))
			const op = this.isType(this.peek(1), $T.VALUE_UNQUOTED)
				? handle.token.value(...this.processToken<true>(this.consume($T.VALUE_UNQUOTED)))
				: undefined
			const sepR = this.isType(this.peek(1), $T.EXP_PROP_OP)
				? handle.token.sep(...this.processToken<true>(this.consume($T.EXP_PROP_OP)))
				: undefined
			if (this.info.expandedSepAlsoCustom && op === undefined && sepR === undefined) {
				setReadOnly(sepL, "type", TOKEN_TYPE.OP_CUSTOM as any)
				rest = {
					sepL: undefined,
					sepR,
					propertyOperator: sepL as any as AnyToken<TOKEN_TYPE.OP_CUSTOM>,
				}
			} else {
				rest = { sepL, sepR, propertyOperator: op }
			}
		} else if (this.isType(next, $T.CUSTOM_PROP_OP)) {
			const op = handle.token.custom(...this.processToken(this.consume($T.CUSTOM_PROP_OP)))
			rest = { propertyOperator: op }
		} else if (this.info.customOpAlsoNegation && this.isType(next, $T.SYM_NOT)) {
			const op = handle.token.custom(...this.processToken(this.consume($T.SYM_NOT)))
			rest = { propertyOperator: op }
		}
		return { prop, rest }
	}

	ruleVariable({
		unprefixed = false,
	}: {
		unprefixed?: boolean
	} = {}): VariableNode | undefined {
		const prefix = this.ruleVariablePrefix({ onlyToken: true, unprefixed })

		const next = this.peek(1)
		const next2 = this.peek(2)
		const next3 = this.peek(3)
		// quoted values
		if (next && (this.isExactType(next, $T.QUOTE_DOUBLE)
			|| this.isExactType(next, $T.QUOTE_SINGLE)
			|| this.isExactType(next, $T.QUOTE_BACKTICK)
		)) {
			const quoteType = next.type
			if (next2?.type === quoteType) {
				// value is missing
				const quoteL = this.ruleQuote(quoteType)
				const quoteR = this.ruleQuote(quoteType)
				return handle.variable(undefined, quoteL, undefined, quoteR)
			}
			if (next3?.type === next.type) {
				const quoteL = this.ruleQuote(quoteType)
				const value = this.isType(next2, $T.VALUE_UNQUOTED) ? this.ruleValueUnquoted({ }) : this.ruleValueNot(quoteType)
				const quoteR = this.ruleQuote(quoteType)
				const prefixToken = prefix ? handle.token.value(...this.processToken<true>(prefix)) : undefined
				return handle.variable(prefixToken, quoteL, value, quoteR)
			}
		}
		if (this.isType(next, $C.REGEX_ANY)) {
			// this is safe since the start can never match flags
			const quoteL = this.ruleRegexAny() as ValidToken<TOKEN_TYPE.REGEX>
			// unlike other values, regexes will swallow all input if incorrect
			const maybeValue = this.peek(1)
			// note the inversion (todo inverse map)
			const value = this.isType(maybeValue, $T.VALUE_REGEX)
			? this.ruleValueNot($C.REGEX_ANY)
			: undefined
			
			const quoteR = this.isType(this.peek(1), $C.REGEX_ANY) ? this.ruleRegexAny() : undefined
			const args = isArray(quoteR) ? quoteR : [quoteR, undefined] as const
			return handle.variable(undefined, quoteL, value, args[0], args[1] as any)
		}
		if (this.isType(next, $T.VALUE_UNQUOTED) && this.isType(next2, $C.QUOTE_ANY)) {
			const value = this.ruleValueUnquoted()
			const quoteR = this.ruleValueDelimAny()
			return handle.variable(undefined, undefined, value, quoteR)
		}
		if (this.isType(next, $C.QUOTE_ANY)) {
			const quoteToken = next as Token<$T.QUOTE_BACKTICK | $T.QUOTE_DOUBLE | $T.QUOTE_SINGLE>
			const quoteL = this.ruleValueDelimAny()
			const maybeValue = this.peek(1)
			const value = !quoteL && this.isType(maybeValue, $T.VALUE_UNQUOTED)
				? this.ruleValueUnquoted()
				// todo, move inverse quote map out of ruleValueNot
				: quoteL && this.isType(maybeValue, quoteToken.type.replace("QUOTE", "VALUE_FOR") as any)
				? this.ruleValueNot(quoteToken.type)
				: undefined
			return handle.variable(undefined, quoteL, value, undefined)
		}
		if (this.isType(next, $T.VALUE_UNQUOTED)) {
			const value = this.ruleValueUnquoted()
			return handle.variable(undefined, undefined, value, undefined)
		}
		return undefined
	}

	ruleValueDelimAny(): ValidToken<TOKEN_TYPE.SINGLEQUOTE | TOKEN_TYPE.DOUBLEQUOTE | TOKEN_TYPE.BACKTICK | TOKEN_TYPE.REGEX> | undefined {
		const next = this.peek(1)!
		
		if (this.isType(next, $C.QUOTE_ANY)) {
			const type = next.value === `"` ? "double" : next.value === "'" ? "single" : next.value === "`" ? "tick" : "regex"
			return handle.delimiter[type](...this.processToken(this.consume($C.QUOTE_ANY)))
		}
		return undefined
	}

	ruleRegexAny(): ValidToken<TOKEN_TYPE.REGEX> | [ValidToken<TOKEN_TYPE.REGEX>, AnyToken<TOKEN_TYPE.VALUE>] {
		const value = this.consume($C.REGEX_ANY)
		if (value.value.length > 1) {
			// cheat a bit to extract the flags
			const delim = {
				value: "/",
				startOffset: value.startOffset,
				endOffset: value.startOffset,
			}
			const flags = {
				value: value.value.slice(1),
				startOffset: value.startOffset + 1,
				endOffset: value.endOffset,
			}
			return [
				// why the ! ??? todo
				handle.delimiter.regex(...this.processToken(delim))!,
				handle.token.value(...this.processToken(flags)),
			]
		}
		return handle.delimiter.regex(...this.processToken(value))!
	}

	ruleValueNot<
		TType extends $T.QUOTE_SINGLE | $T.QUOTE_DOUBLE | $T.QUOTE_BACKTICK | $C.REGEX_ANY,
	>(
		type: TType,
	): ValidToken<
			TOKEN_TYPE.VALUE
		> {
		const realType = {
			[$T.QUOTE_SINGLE]: $C.VALUE_FOR_SINGLE,
			[$T.QUOTE_DOUBLE]: $C.VALUE_FOR_DOUBLE,
			[$T.QUOTE_BACKTICK]: $C.VALUE_FOR_BACKTICK,
			[$C.REGEX_ANY]: $T.VALUE_REGEX,
		}[type]
		if (realType === undefined) {
			unreachable(`Unknown quote/regex type ${type}`)
		}
		const value = this.consume(realType)
		if (realType !== value.type) {
			unreachable(`Expected value type ${realType}, got ${value.type}`)
		}
		return handle.token.value(...this.processToken(value)) as any
	}

	ruleQuote<TType extends $T.QUOTE_SINGLE | $T.QUOTE_DOUBLE | $T.QUOTE_BACKTICK >(
		type: TType,
	): ValidToken<
		TType extends $T.QUOTE_SINGLE
		? TOKEN_TYPE.SINGLEQUOTE
		: TType extends $T.QUOTE_DOUBLE
		? TOKEN_TYPE.DOUBLEQUOTE
		: TType extends $T.QUOTE_BACKTICK
		? TOKEN_TYPE.BACKTICK
		: never
		> {
		const quote = this.peek(1)
		if (type !== quote?.type) {
			throw new Error(`Expected quote type ${type}, got ${quote?.type}`)
		}
		
		switch (type) {
			case $T.QUOTE_SINGLE:
				return handle.delimiter.single(
					...this.processToken(this.consume($T.QUOTE_SINGLE)),
				) as any
			case $T.QUOTE_DOUBLE:
				return handle.delimiter.double(
					...this.processToken(this.consume($T.QUOTE_DOUBLE)),
				) as any
			case $T.QUOTE_BACKTICK:
				return handle.delimiter.tick(
					...this.processToken(this.consume($T.QUOTE_BACKTICK)),
				) as any
		}
		throw new Error(`Expected quote type ${type}`)
	}
	

	ruleVariablePrefix<TOnlyToken extends boolean = false>(
		{
			
			onlyToken = false as TOnlyToken,
			unprefixed = false,
		}: {
			onlyToken?: TOnlyToken
			unprefixed?: boolean
		} = {},
	): TOnlyToken extends true ? Token<$T.VALUE_UNQUOTED> | undefined : AnyToken<TOKEN_TYPE.VALUE> | undefined {
		const next = this.peek(1)
		const next2 = this.peek(2)
		const next4 = this.peek(4)
		if (!unprefixed && this.options.prefixableStrings !== undefined
			&& this.isType(next2, $C.QUOTE_ANY)
			&& next2 && this.isType(next4, next2.type)
			&& next && this.options.prefixableStrings.includes(next.value)
		) {
			return this.ruleValueUnquoted({ onlyToken }) as any
		}
		if (onlyToken) return undefined as any
		return handle.token.value(...this.processToken()) as any
	}

	ruleValueUnquoted<TOnlyToken extends boolean = false>(
		{
			onlyToken = false as TOnlyToken,
		}: {
			onlyToken?: TOnlyToken
		} = {},
	): TOnlyToken extends true ? Token<$T.VALUE_UNQUOTED> : AnyToken<TOKEN_TYPE.VALUE> {
		const t = this.consume($T.VALUE_UNQUOTED)
		const res = onlyToken ? t : handle.token.value(...this.processToken(t))
		return (res) as any
	}

	ruleParenL(): ValidToken<TOKEN_TYPE.PARENL> | undefined {
		const next = this.peek(1)
		const value = next?.type === $T.PAREN_L
			? this.consume($T.PAREN_L)
			: this.createErrorToken($T.PAREN_L)
		const loc = extractPosition(value, this.state.shift)
		return this.state.shift === 0 || loc.start > 0
			? handle.delimiter.parenL(value.isError ? undefined : value.value, loc)
			: undefined
	}

	ruleParenR(): ValidToken<TOKEN_TYPE.PARENR> | undefined {
		const value = this.consume($T.PAREN_R)
		return handle.delimiter.parenR(...this.processToken(value))
	}

	ruleBracketL(): ValidToken<TOKEN_TYPE.BRACKETL> | undefined {
		const next = this.peek(1)
		const value = next?.type === $T.BRACKET_L
			? this.consume($T.BRACKET_L)
			: this.createErrorToken($T.BRACKET_L)
		const loc = extractPosition(value, this.state.shift)
		return this.state.shift === 0 || loc.start > 0
			? handle.delimiter.bracketL(value.isError ? undefined : value.value, loc)
			: undefined
	}

	ruleBracketR(): ValidToken<TOKEN_TYPE.BRACKETR> | undefined {
		const value = this.consume($T.BRACKET_R)
		return handle.delimiter.bracketR(...this.processToken(value))
	}
	
	ruleNot(): ValidToken<TOKEN_TYPE.NOT> | undefined {
		if (this.isType(this.peek(1), $C.OPERATOR_NOT)) {
			const op = this.consume($C.OPERATOR_NOT)
			return handle.operator.not(...this.processToken<true>(op))
		}
		return undefined
	}
}

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

