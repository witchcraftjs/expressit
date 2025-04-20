/* eslint-disable max-lines */
import { get } from "@alanscodelog/utils/get.js"
import { insert } from "@alanscodelog/utils/insert.js"
import { isArray } from "@alanscodelog/utils/isArray.js"
import { isWhitespace } from "@alanscodelog/utils/isWhitespace.js"
import { setReadOnly } from "@alanscodelog/utils/setReadOnly.js"
import type { AddParameters , DeepPartial } from "@alanscodelog/utils/types"
import { unreachable } from "@alanscodelog/utils/unreachable.js"

import { pos } from "./ast/builders/pos.js"
import { createCondition } from "./ast/createNormalizedCondition.js"
import { createExpression } from "./ast/createNormalizedExpression.js"
import * as handle from "./ast/handlers.js"
import { applyBoolean } from "./internal/applyBoolean.js"
import { applyPrefix } from "./internal/applyPrefix.js"
import { checkParserOpts } from "./internal/checkParserOpts.js"
import { escapeVariableOrPrefix } from "./internal/escapeVariableOrPrefix.js"
import { extractPosition } from "./internal/extractPosition.js"
import { getUnclosedRightParenCount } from "./internal/getUnclosedRightParenCount.js"
import { parseParserOptions } from "./internal/parseParserOptions.js"
import { unescape } from "./internal/unescape.js"
import { $C, type $CType, $T, type $TType, Lexer, type LexerCategoryToken, type LexerRealToken, type LexerToken,type Token } from "./Lexer.js"
import type { ArrayNode, ConditionNode, GroupNode, NormalizedCondition, NormalizedExpression, ParserResults, TokenBoolean, TokenType, ValidToken, VariableNode } from "./types/ast.js"
import { type AnyToken, AST_TYPE, type Completion, type Position, type Suggestion, SUGGESTION_TYPE, type SuggestionType,TOKEN_TYPE } from "./types/index.js"
import type { FullParserOptions, KeywordEntry, ParserOptions, ValidationQuery, ValueQuery } from "./types/parser.js"
import { extractTokens } from "./utils/extractTokens.js"
import { generateParentsMap } from "./utils/generateParentsMap.js"
import { getCursorInfo } from "./utils/getCursorInfo.js"
import { getParent } from "./utils/getParent.js"
import { getSurroundingErrors } from "./utils/getSurroundingErrors.js"
import { isNode } from "./utils/isNode.js"
import { isToken } from "./utils/isToken.js"

const OPPOSITE = {
	[TOKEN_TYPE.AND]: TOKEN_TYPE.OR,
	[TOKEN_TYPE.OR]: TOKEN_TYPE.AND,
}

function isEqualSet(setA: Set<any>, setB: Set<any>): boolean {
	if (setA.size !== setB.size) return false
	for (const key of setA) {
		if (!setB.has(key)) return false
	}
	return true
}

const defaultNodeDirs = {
	before: false,
	after: false,
}

const createDefaultRequires = (partial: DeepPartial<Suggestion["requires"]> = {}): Suggestion["requires"] => ({
	whitespace: {
		...defaultNodeDirs,
		...(partial.whitespace ?? {}),
	},
	group: partial.group ?? false,
	prefix: partial.prefix ?? false,
})

/** Returns if valid token requires whitespace if none between cursor and token. */
const tokenRequiresWhitespace = (valid: ValidToken | undefined, whitespace: boolean, wordOps: KeywordEntry[]): boolean => {
	if (whitespace || valid === undefined) return false
	return valid.type === TOKEN_TYPE.VALUE ||
		(([TOKEN_TYPE.AND, TOKEN_TYPE.OR, TOKEN_TYPE.NOT] as string[]).includes(valid.type) &&
			wordOps.find(_ => _.value === valid.value) !== undefined)
}
const tokenVariable = [TOKEN_TYPE.BACKTICK, TOKEN_TYPE.DOUBLEQUOTE, TOKEN_TYPE.SINGLEQUOTE, TOKEN_TYPE.VALUE, TOKEN_TYPE.REGEX]

/**
 * Creates the main parser class which handles all functionality (evaluation, validation, etc).
 */
export class Parser<T = any> {
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

	private readonly $: Record<$TType, LexerRealToken<$TType>>

	private readonly $categories: Partial<Record<$CType, LexerCategoryToken<$CType>>>

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
		lexedTokens: Token<$TType>[]
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
		tokens: Token<$TType> []
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
			tokens: Token<$TType> []
			shift: number
			rawInput: string
		},
	): ParserResults {
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
		this.state = {
			rawInput: "",
			shift: 0,
			index: -1,
			lexedTokens: [],
		}
		return res
	}

	subParserOne?: Parser<T>
 
	subParserTwo?: Parser<T>

	createSubParserIfNotExists(opts: ParserOptions<T>, which: "One" | "Two" = "One"): Parser["subParserOne"] {
		if (this[`subParser${which}`] === undefined) {
			this[`subParser${which}`] = new Parser(opts)
		}
		return this[`subParser${which}`]!
	}
	
	
	transformCategoryToken<TC extends $CType>(
		token: Token,
		categoryToken: LexerCategoryToken<TC>,
	): Token<TC> {
		return {
			...token,
			type: categoryToken.type,
		}
	}

	getCategoryTokens<TType extends $CType>(
		type: TType,
	): LexerCategoryToken<TType>["entries"] | undefined {
		return this.$categories[type as $CType]?.entries as any
	}

	getTokenType(type: $TType | $CType): LexerToken<$TType> | undefined {
		return this.$[type as any as $TType] as any
	}

	isExactType<TType extends $TType>(token: Token, type: TType): token is Token<TType> {
		if (this.$[type]) {
			return this.isType(token, type)
		}
		return false
	}

	isType(token: Token | undefined, type: $TType | $CType): boolean {
		if (token === undefined) return false
		if (token.type === type) return true
		const tokenType = this.getTokenType(token.type)
		
		if (tokenType?.type === type) return true
		const category = this.$categories[type as $CType]
		if (category?.entries[token.type as $TType] !== undefined) {
			return true
		}
		return false
	}

	createErrorToken(type: $TType, index?: number): Token {
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
	

	peek(n = 1): Token<$TType> | undefined {
		return this.state.lexedTokens[this.state.index + n]
	}

	nextIsEof(): boolean {
		return this.peek(1) === undefined
	}

	consumeAny(): Token<$TType> {
		return this.consume(this.peek(1)?.type)
	}

	consume<
		TType extends $TType | $CType,
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
		if (this.$categories[type as $CType] !== undefined) {
			const categoryToken = this.$categories[type as $CType]
			const tokenType = categoryToken?.entries[nextToken.type as $TType]
			if (categoryToken && tokenType) {
				this.state.index++
				return this.transformCategoryToken(nextToken, categoryToken) as Token<TType>
			} else {
				throw new Error("here")
			}
		} else {
			const tokenType = this.getTokenType(type as $TType)
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
			: !property.prop.value.valid
				? ""
				: property.prop.value.value

		const propOpVal = property?.rest?.propertyOperator === undefined
			? undefined
			: !property.rest.propertyOperator?.valid
				? ""
				: property.rest.propertyOperator?.value


		const isExpanded = (property?.rest?.sepL ?? property?.rest?.sepR) !== undefined

		const convertRegexValues = typeof this.options.regexValues === "function"
		&& !this.options.regexValues(propVal, propOpVal, isExpanded)

		const convertArrayValues = typeof this.options.arrayValues === "function"
		&& !this.options.arrayValues(propVal, propOpVal, isExpanded)
		
		let value = this.ruleConditionValue(property, { convertRegexValues, convertArrayValues })
		
		let group
		if (
			isNode(value)
			&& !(value.type === AST_TYPE.ARRAY)
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
		if (
			convertRegexValues && isNode(value)
			&& value.type === AST_TYPE.VARIABLE
			&& value.quote?.left.type === TOKEN_TYPE.REGEX
		) {
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
			ValidToken<typeof TOKEN_TYPE.PARENL> | undefined,
			GroupNode["expression"],
		ValidToken<typeof TOKEN_TYPE.PARENR> | undefined,
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
			const parsed = this.subParserOne!.parse(" ".repeat(start) + subInput)
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
		const parsed = this.subParserTwo!.parse(" ".repeat(start) + subInput)
		if ("type" in parsed && parsed.type === AST_TYPE.CONDITION) {
			return parsed.value as ArrayNode
		}
		if (("valid" in parsed && !parsed.valid)
			|| ("type" in parsed && (parsed.type === AST_TYPE.EXPRESSION || parsed.type === AST_TYPE.GROUP))
		) {
			unreachable("parsed.value should not be an ErrorToken, ExpressionNode, or GroupNode.")
		}
		return parsed as any as VariableNode
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
					propertyOperator: sepL as any as AnyToken<typeof TOKEN_TYPE.OP_CUSTOM>,
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
			const quoteL = this.ruleRegexAny() as ValidToken<typeof TOKEN_TYPE.REGEX>
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
			const quoteToken = next as Token<typeof $T.QUOTE_BACKTICK | typeof $T.QUOTE_DOUBLE | typeof $T.QUOTE_SINGLE>
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

	ruleValueDelimAny(): ValidToken<typeof TOKEN_TYPE.SINGLEQUOTE | typeof TOKEN_TYPE.DOUBLEQUOTE | typeof TOKEN_TYPE.BACKTICK | typeof TOKEN_TYPE.REGEX> | undefined {
		const next = this.peek(1)!
		
		if (this.isType(next, $C.QUOTE_ANY)) {
			const type = next.value === `"` ? "double" : next.value === "'" ? "single" : next.value === "`" ? "tick" : "regex"
			return handle.delimiter[type](...this.processToken(this.consume($C.QUOTE_ANY)))
		}
		return undefined
	}

	ruleRegexAny(): ValidToken<typeof TOKEN_TYPE.REGEX> | [ValidToken<typeof TOKEN_TYPE.REGEX>, AnyToken<typeof TOKEN_TYPE.VALUE>] {
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
		TType extends typeof $T.QUOTE_SINGLE | typeof $T.QUOTE_DOUBLE | typeof $T.QUOTE_BACKTICK | typeof $C.REGEX_ANY,
	>(
		type: TType,
	): ValidToken<
			typeof TOKEN_TYPE.VALUE
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

	ruleQuote<TType extends typeof $T.QUOTE_SINGLE | typeof $T.QUOTE_DOUBLE | typeof $T.QUOTE_BACKTICK >(
		type: TType,
	): ValidToken<
		TType extends typeof $T.QUOTE_SINGLE
		? typeof TOKEN_TYPE.SINGLEQUOTE
		: TType extends typeof $T.QUOTE_DOUBLE
		? typeof TOKEN_TYPE.DOUBLEQUOTE
		: TType extends typeof $T.QUOTE_BACKTICK
		? typeof TOKEN_TYPE.BACKTICK
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
	): TOnlyToken extends true ? Token<typeof $T.VALUE_UNQUOTED> | undefined : AnyToken<typeof TOKEN_TYPE.VALUE> | undefined {
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
	): TOnlyToken extends true ? Token<typeof $T.VALUE_UNQUOTED> : AnyToken<typeof TOKEN_TYPE.VALUE> {
		const t = this.consume($T.VALUE_UNQUOTED)
		const res = onlyToken ? t : handle.token.value(...this.processToken(t))
		return (res) as any
	}

	ruleParenL(): ValidToken<typeof TOKEN_TYPE.PARENL> | undefined {
		const next = this.peek(1)
		const value = next?.type === $T.PAREN_L
			? this.consume($T.PAREN_L)
			: this.createErrorToken($T.PAREN_L)
		const loc = extractPosition(value, this.state.shift)
		return this.state.shift === 0 || loc.start > 0
			? handle.delimiter.parenL(value.isError ? undefined : value.value, loc)
			: undefined
	}

	ruleParenR(): ValidToken<typeof TOKEN_TYPE.PARENR> | undefined {
		const value = this.consume($T.PAREN_R)
		return handle.delimiter.parenR(...this.processToken(value))
	}

	ruleBracketL(): ValidToken<typeof TOKEN_TYPE.BRACKETL> | undefined {
		const next = this.peek(1)
		const value = next?.type === $T.BRACKET_L
			? this.consume($T.BRACKET_L)
			: this.createErrorToken($T.BRACKET_L)
		const loc = extractPosition(value, this.state.shift)
		return this.state.shift === 0 || loc.start > 0
			? handle.delimiter.bracketL(value.isError ? undefined : value.value, loc)
			: undefined
	}

	ruleBracketR(): ValidToken<typeof TOKEN_TYPE.BRACKETR> | undefined {
		const value = this.consume($T.BRACKET_R)
		return handle.delimiter.bracketR(...this.processToken(value))
	}
	
	ruleNot(): ValidToken<typeof TOKEN_TYPE.NOT> | undefined {
		if (this.isType(this.peek(1), $C.OPERATOR_NOT)) {
			const op = this.consume($C.OPERATOR_NOT)
			return handle.operator.not(...this.processToken<true>(op))
		}
		return undefined
	}

	/**
	 * Given the ast, a list of {@link Suggestion} entries, the parser options, and a list of variables, prefixes, operators, etc, and the preferred quote type, returns a list of {@link Completion} entries.
	 *
	 * It takes care of suggesting the correct delimiters for fixes, quoting variables/prefixes if it would not be possible to parse them unquoted, and separating symbol from non-symbol (word) operators.
	 *
	 * Does not add whitespace or group requirements. The suggestion information is still in the completion if you wish to show these. But they should not be added to the completion value if using {@link autoreplace} which will take care of it.
	 *
	 * Is not aware of existing values. You will have to use {@link getCursorInfo} to understand the context in which the suggestion was made, so that, for example, you could filter out used regex flags.
	 */
	autocomplete(
		ast: ParserResults,
		suggestions: Suggestion[],
		{
			values = [], arrayValues = [], variables = [], prefixes = [], properties = [], expandedPropertyOperators = [], customPropertyOperators = (this as any as Parser<T>).options.customPropertyOperators ?? [], keywords = (this as any as Parser<T>).options.keywords, regexFlags = ["i", "m", "u"], quote = "\"",
		}: Partial<Record<
			"variables" |
			"values" |
			"arrayValues" |
			"prefixes" |
			"properties" |
			"regexFlags" |
			"expandedPropertyOperators" |
			"customPropertyOperators", string[]>> & {
				quote?: string
				keywords?: FullParserOptions<T>["keywords"]
			} = {},
	): Completion[] {
		const parentMap = generateParentsMap(ast)
		const self = (this as any as Parser<T>)
		return suggestions.map(suggestion => {
			const type = suggestion.type
			switch (type) {
				case SUGGESTION_TYPE.BACKTICK: return [{ suggestion, value: "`" }]
				case SUGGESTION_TYPE.DOUBLEQUOTE: return [{ suggestion, value: "\"" }]
				case SUGGESTION_TYPE.SINGLEQUOTE: return [{ suggestion, value: "'" }]
				case SUGGESTION_TYPE.PARENL: return [{ suggestion, value: "(" }]
				case SUGGESTION_TYPE.PARENR: return [{ suggestion, value: ")" }]
				case SUGGESTION_TYPE.BRAKCETR: return [{ suggestion, value: "]" }] // L not needed
				case SUGGESTION_TYPE.REGEX: return [{ suggestion, value: "/" }]
				case SUGGESTION_TYPE.REGEX_FLAGS:
					return regexFlags
						.map(value => ({ suggestion, value }))
						// remove existing flags from suggestions
						.filter(completion => {
							// eslint-disable-next-line @typescript-eslint/no-shadow
							const { suggestion, value } = completion
							if (suggestion.type !== SUGGESTION_TYPE.REGEX_FLAGS) {return true}

							const token = suggestion.cursorInfo
							const flags = token.at && (getParent(token.at, parentMap) as VariableNode)?.quote?.flags === suggestion.cursorInfo.at
								? token.at
								: token.next && (getParent(token.next, parentMap) as VariableNode)?.quote?.flags === suggestion.cursorInfo.next
									? token.next
									: token.prev && (getParent(token.prev, parentMap) as VariableNode)?.quote?.flags === suggestion.cursorInfo.prev
										? token.prev
										: undefined

							if (flags?.value?.includes(value)) {return false}
							return true
						})
				case SUGGESTION_TYPE.PROPERTY: {
					return properties.map(value => ({ suggestion, value }))
				}
				case SUGGESTION_TYPE.PROPERTY_SEP: {
					return [{ suggestion, value: self.options.expandedPropertySeparator! }]
				}
				case SUGGESTION_TYPE.EXPANDED_PROPERTY_OPERATOR: {
					return expandedPropertyOperators.map(value => ({ suggestion, value }))
				}
				case SUGGESTION_TYPE.CUSTOM_PROPERTY_OPERATOR: {
					return customPropertyOperators.map(value => ({ suggestion, value }))
				}
				case SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP: {
					const keywordsList = [...keywords.and, ...keywords.or]
					const symOpts = keywordsList.filter(_ => _.isSymbol)
					return symOpts.map(({ value }) => ({ suggestion, value }))
				}
				case SUGGESTION_TYPE.BOOLEAN_WORD_OP: {
					const keywordsList = [...keywords.and, ...keywords.or]
					const wordOpts = keywordsList.filter(_ => !_.isSymbol)
					return wordOpts.map(({ value }) => ({ suggestion, value }))
				}
				case SUGGESTION_TYPE.VALUE:
				case SUGGESTION_TYPE.ARRAY_VALUE:
				case SUGGESTION_TYPE.VARIABLE: {
					const arr = type === SUGGESTION_TYPE.VARIABLE
						? variables
						: type === SUGGESTION_TYPE.ARRAY_VALUE
							? arrayValues
							: type === SUGGESTION_TYPE.VALUE
								? values
								: unreachable()
					return arr.map(variable => ({ suggestion, value: escapeVariableOrPrefix(variable, quote) }))
				}
				case SUGGESTION_TYPE.PREFIX: return prefixes.map(prefix => ({ suggestion, value: escapeVariableOrPrefix(prefix, quote) }))
			}
		}).flat()
	}

	/**
	 * Given the input string and a {@link Completion} consisting of the value of the replacement and a {@link Suggestion} entry, returns the replacement string and the new position of the cursor.
	 *
	 * The value passed should be escaped if it's needed (or quoted). {@link autocomplete} already takes care of quoting variables if you're using it.
	 */
	autoreplace(
		input: string,
		{ value, suggestion }: Completion,
	): { replacement: string, cursor: number } {
		const isQuotedLeft = ["\"", "'", "`"].includes(value[0])
		const isQuotedRight = ["\"", "'", "`"].includes(value[value.length - 1])
		if ((isQuotedLeft && !isQuotedRight) || (!isQuotedLeft && isQuotedRight)) {
			throw new Error(`Completion value must either be entirely quoted or entirely unquoted. But the left side is ${isQuotedLeft ? "quoted" : "unquoted"} and the right side is ${isQuotedRight ? "quoted" : "unquoted"}.`)
		}
		let cursor = suggestion.range.start + value.length

		if (suggestion.requires.prefix) {
			value = suggestion.requires.prefix + (isQuotedLeft ? "" : "\"") + value + (isQuotedRight ? "" : "\"")

			cursor += suggestion.requires.prefix.length + Number(!isQuotedLeft) + Number(!isQuotedRight)
		}
		if (suggestion.requires.group) {
			value += "()"
			cursor++
		}

		if (suggestion.requires.whitespace.before // &&
		) {
			value = ` ${value}`
			cursor++
		}
		if (suggestion.requires.whitespace.after // &&
		) {
			value = `${value} `
		}

		const replacement = insert(value, input, [suggestion.range.start, suggestion.range.end])
		return { replacement, cursor }
	}

	/**
	 * Returns a list of suggestions ( {@link Suggestion} ). These are not a list of autocomplete entries (with values), but more a list of entries describing possible suggestions. This list can then be passed to {@link Parser}["autocomplete"] to build a list to show users, from which you can then pick an entry to pass to {@link Parser}["autoreplace"] .
	 *
	 * The list returned is "unsorted", but there is still some logic to the order. Fixes for errors are suggested first, in the order returned by {@link getSurroundingErrors}. Regular suggestions come after in the following order: prefixes if enabled, variables, boolean symbol operators, then boolean word operators.
	 *
	 * When the cursor is between two tokens that have possible suggestions, only suggestion types for the token before are returned. For example:
	 *
	 * ```js
	 * prop="val"
	 * prop|="val" //returns a property suggestions to replace `prop`
	 * prop=|"val" //returns a custom operator suggestion to replace `=`
	 * prop="|val" //returns a value suggestion
	 * ```
	 *
	 * And if there are no suggestions for the previous token but there are for the next ones, they are suggested:
	 * ```js
	 * prop:op:"val"
	 * prop:op|:"val" // returns an operator suggestion
	 * prop:op:|"val" // returns a value suggestion
	 * prop:op|"val" // returns a suggestion for the missing separator
	 * ```
	 */
	autosuggest(input: string, ast: ParserResults, index: number): Suggestion[] {
		const parentMap = generateParentsMap(ast)
		// wrapped like this because the function is HUGE
		const opts = (this as any as Parser<T>).options
		const tokens = extractTokens(ast)
		const token = getCursorInfo(input, tokens, index)

		const wordOps = [...opts.keywords.and, ...opts.keywords.or, ...opts.keywords.not].filter(op => !op.isSymbol)

		const canSuggestOpAfterPrev = (
			token.valid.prev && (tokenVariable as string[]).includes(token.valid.prev?.type) &&
			(token.whitespace.prev || token.valid.prev.type === TOKEN_TYPE.PARENR) &&
			!token.at && token.valid.next === undefined
		)
		const canSuggestOpBeforeNext =
			(
				token.valid.next && (tokenVariable as string[]).includes(token.valid.next?.type) &&
				token.whitespace.next && // no parenL allowed since check since there will already be prefix suggestions
				!token.at && token.valid.prev === undefined
			)

		const requiresWhitespacePrev = tokenRequiresWhitespace(token.valid.prev, token.whitespace.prev, wordOps)
		const requiresWhitespaceNext = tokenRequiresWhitespace(token.valid.next, token.whitespace.next, wordOps)

		const requiresWhitespacePrevOp = canSuggestOpAfterPrev
			? false
			: requiresWhitespacePrev
		const requireWhitespaceNextOp = !canSuggestOpAfterPrev && canSuggestOpBeforeNext
			? false
			: requiresWhitespaceNext

		const suggestions: Suggestion[] = []
		if (isToken(ast) && !ast.valid) {
			suggestions.push({
				type: SUGGESTION_TYPE.PREFIX,
				requires: createDefaultRequires({ group: true }),
				range: pos({ start: index }, { fill: true }),
				isError: true,
				cursorInfo: token,
			})
			suggestions.push({
				type: SUGGESTION_TYPE.VARIABLE,
				requires: createDefaultRequires(),
				range: pos({ start: index }, { fill: true }),
				isError: true,
				cursorInfo: token,
			})
		} else {
			const surroundingErrors = getSurroundingErrors(tokens, token)

			const errorTypesHandled: TokenType[] = []
			const errorSuggestion = {
				isError: true,
				cursorInfo: token,
			}
			const baseSuggestion = {
				isError: false,
				cursorInfo: token,
			}
			for (const error of surroundingErrors) {
				for (const type of error.expected) {
					if (errorTypesHandled.includes(type)) continue
					errorTypesHandled.push(type)

					switch (type) {
						case TOKEN_TYPE.DOUBLEQUOTE:
						case TOKEN_TYPE.SINGLEQUOTE:
						case TOKEN_TYPE.BACKTICK: {
							const errorParent = getParent(error, parentMap)
							const isLeft = (errorParent as VariableNode).quote!.left === error
							const isRight = (errorParent as VariableNode).quote!.right === error
							suggestions.push({
								...errorSuggestion,
								type: type as any as SuggestionType,
								requires: createDefaultRequires({
									whitespace: {
										before: isRight ? false : requiresWhitespacePrev,
										after: isLeft ? false : requiresWhitespaceNext,
									},
								}),
								range: pos({ start: index }, { fill: true }),
							})
						} break
						case TOKEN_TYPE.AND:
						case TOKEN_TYPE.OR:
							suggestions.push({
								...errorSuggestion,
								type: SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							suggestions.push({
								...errorSuggestion,
								type: SUGGESTION_TYPE.BOOLEAN_WORD_OP,
								requires: createDefaultRequires({
									whitespace: {
										before: requiresWhitespacePrevOp,
										after: requireWhitespaceNextOp,
									},
								}),
								range: pos({ start: index }, { fill: true }),
							})
							if (type === TOKEN_TYPE.AND) errorTypesHandled.push(TOKEN_TYPE.OR)
							if (type === TOKEN_TYPE.OR) errorTypesHandled.push(TOKEN_TYPE.AND)

							break
						case TOKEN_TYPE.PARENL:
						case TOKEN_TYPE.PARENR:
							suggestions.push({
								...errorSuggestion,
								type: type as any as SuggestionType,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							break
						case TOKEN_TYPE.VALUE: {
							const errorParent = getParent(error, parentMap)
							const prefixedValue = errorParent?.type === AST_TYPE.VARIABLE
							? (getParent(error, parentMap) as VariableNode)?.prefix?.value
							: false
							const isRegexValue = errorParent?.type === AST_TYPE.VARIABLE && (
								errorParent.quote?.left.type === TOKEN_TYPE.REGEX ||
								errorParent.quote?.right.type === TOKEN_TYPE.REGEX
							)
							if (!isRegexValue) {
								// both are always suggested since missing value tokens only happen for variables
								if (!prefixedValue && opts.prefixableGroups) {
									suggestions.push({
										...errorSuggestion,
										type: SUGGESTION_TYPE.PREFIX,
										requires: createDefaultRequires({
											whitespace: {
												before: requiresWhitespacePrev,
												after: false, /* parens get inserted */
											},
											group: true, // is always needed
										}),
										range: pos({ start: index }, { fill: true }),
									})
								}
								suggestions.push({
									...errorSuggestion,
									type: SUGGESTION_TYPE.VARIABLE,
									requires: createDefaultRequires({
										whitespace: {
											before: requiresWhitespacePrev,
											after: requiresWhitespaceNext,
										},
										prefix: prefixedValue,
									}),
									range: pos({ start: index }, { fill: true }),
								})
							}
							break
						}
						case TOKEN_TYPE.BRACKETR: {
							suggestions.push({
								...errorSuggestion,
								type: SUGGESTION_TYPE.BRAKCETR,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							break
						}
						case TOKEN_TYPE.OP_EXPANDED_SEP:
							suggestions.push({
								...errorSuggestion,
								type: SUGGESTION_TYPE.PROPERTY_SEP,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							break
						case TOKEN_TYPE.REGEX:
							suggestions.push({
								...errorSuggestion,
								type: SUGGESTION_TYPE.REGEX,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							break
						case TOKEN_TYPE.OP_CUSTOM:
						case TOKEN_TYPE.BRACKETL:
						case TOKEN_TYPE.NOT:
							unreachable()
					}
				}
			}
			

			/** The quotes are checked because of situations like `prefix|"var"`.*/
			const prevVar = getParent(token.valid.prev, parentMap)
			const nextVar = getParent(token.valid.next, parentMap)
			const prevCondition = getParent(prevVar, parentMap)
			const nextCondition = getParent(nextVar, parentMap)
			const atVar = getParent(token.at, parentMap)
			const atCondition = getParent(atVar, parentMap)

			const isVarPrev =
				!token.whitespace.prev &&
				token.valid.prev?.type !== TOKEN_TYPE.REGEX &&
				prevVar?.type === AST_TYPE.VARIABLE &&
				(
					(
						prevCondition?.type === AST_TYPE.CONDITION &&
						prevCondition.value === prevVar &&
						(
							prevVar.quote?.right === token.valid.prev ||
							prevVar.value === token.valid.prev
						)
					) ||
					(
						prevCondition?.type === AST_TYPE.ARRAY
					)
				)

			const isVarNext =
				!token.whitespace.next &&
				token.valid.next?.type !== TOKEN_TYPE.REGEX &&
				nextVar?.type === AST_TYPE.VARIABLE
				&& (
					(
						nextCondition?.type === AST_TYPE.CONDITION &&
						nextCondition.value === nextVar &&
						(
							nextVar.quote?.left === token.valid.next ||
							nextVar.value === token.valid.next
						)
					) ||
					(
						nextCondition?.type === AST_TYPE.ARRAY
					)
				)

			const isVarAt = (
				(
					atVar?.type === AST_TYPE.VARIABLE &&
					atCondition?.type === AST_TYPE.CONDITION
				) ||
				(
					prevVar?.type === AST_TYPE.VARIABLE &&
					token.valid.prev === prevVar?.quote?.left) ||

				(
					nextVar?.type === AST_TYPE.VARIABLE &&
					token.valid.next === nextVar?.quote?.right
				)
			)

			const isPropertyPrev =
				prevCondition?.type === AST_TYPE.CONDITION &&
				prevVar !== undefined &&
				prevVar === prevCondition?.property
			const isPropertyNext =
				nextCondition?.type === AST_TYPE.CONDITION &&
				nextVar !== undefined &&
				nextVar === nextCondition?.property
			const isPropertyAt =
				atCondition?.type === AST_TYPE.CONDITION &&
				atVar !== undefined &&
				atVar === atCondition?.property

			const isPropertyOperatorPrev = prevVar?.type === AST_TYPE.CONDITION
			&& token.valid.prev === prevVar?.propertyOperator
			const isPropertyOperatorNext = nextVar?.type === AST_TYPE.CONDITION
			&& token.valid.next === nextVar?.propertyOperator
			const isPropertyOperatorAt = atVar?.type === AST_TYPE.CONDITION
			&& token.at === atVar?.propertyOperator

			/** Situations like `[|]` and `[|` */
			const noArrayValuesTarget = token.valid.prev?.type === TOKEN_TYPE.BRACKETL &&
				(
					token.valid.next === undefined ||
					token.valid.next?.type === TOKEN_TYPE.BRACKETR
				)

			/** For the following, prev tokens always have priority, next suggestions are only allowed if there are not other prev suggestions. Then lastly, only one at suggestion can exist at a time so no checks needed for those. */
			const target = isVarPrev
				? token.valid.prev
				: !noArrayValuesTarget && !isPropertyPrev && !isPropertyOperatorPrev && isVarNext
					? token.valid.next
					: isVarAt
						? token.at
						: undefined


			const propertyTarget = isPropertyPrev
				? token.valid.prev
				: !noArrayValuesTarget && !isVarPrev && !isPropertyOperatorPrev && isPropertyNext
					? token.valid.next
					: isPropertyAt
						? token.at
						: undefined

			const propOpTarget = isPropertyOperatorPrev
				? token.valid.prev
				: !noArrayValuesTarget && !isVarPrev && !isPropertyPrev && isPropertyOperatorNext
					? token.valid.next
					: isPropertyOperatorAt
						? token.at
						: undefined


			if (target) {
				const parent = getParent(target, parentMap)
				if (parent && parent.type === AST_TYPE.VARIABLE) {
					const range = pos(parent)
					const parentParent = getParent(parent, parentMap)
					const condition = parentParent as ConditionNode
					const isValue = condition.propertyOperator !== undefined && condition.value === parent
					const maybeGroup = getParent(parentParent, parentMap)
					const isPrefix = maybeGroup?.type === AST_TYPE.GROUP
					&& maybeGroup.prefix === condition

					// look at whitespace before/after the entire variable
					const varStart = getCursorInfo(input, ast, parent.start)
					const varEnd = getCursorInfo(input, ast, parent.end)
					const targetRequiresWhitespacePrev = tokenRequiresWhitespace(varStart.valid.prev, varStart.whitespace.prev, wordOps)
					const targetRequiresWhitespaceNext = tokenRequiresWhitespace(varEnd.valid.next, varEnd.whitespace.next, wordOps)
					const prefixedValue = parent.type === AST_TYPE.VARIABLE ? parent?.prefix?.value : false

					// most of these require additional handling below
					const isSepPrev = token.prev?.type === TOKEN_TYPE.OP_EXPANDED_SEP
					const arrayValue = parentParent?.type === AST_TYPE.ARRAY
					const isRegexFlag = target === parent.quote?.flags

					if (!isRegexFlag && !isSepPrev && !isValue && !arrayValue && !prefixedValue && opts.prefixableGroups) {
						suggestions.push({
							...baseSuggestion,
							type: SUGGESTION_TYPE.PREFIX,
							requires: createDefaultRequires({
								group: !isPrefix,
								whitespace: {
									before: targetRequiresWhitespacePrev && !isPrefix,
									after: false, // parens exist or get inserted
								},
							}),
							range,
						})
					}

					if (!isRegexFlag && !isPrefix) {
						suggestions.push({
							...baseSuggestion,
							type: arrayValue
								? SUGGESTION_TYPE.ARRAY_VALUE
								: isValue
									? SUGGESTION_TYPE.VALUE
									: SUGGESTION_TYPE.VARIABLE,
							requires: createDefaultRequires({
								whitespace: {
									before: targetRequiresWhitespacePrev,
									after: targetRequiresWhitespaceNext,
								},
								prefix: prefixedValue,
							}),
							range,
						})
					}
				}
			}

			if (noArrayValuesTarget) {
				suggestions.push({
					...baseSuggestion,
					type: SUGGESTION_TYPE.ARRAY_VALUE,
					requires: createDefaultRequires(),
					range: pos({ start: index }, { fill: true }),
				})
			}

			if (propertyTarget) {
				suggestions.push({
					...baseSuggestion,
					type: SUGGESTION_TYPE.PROPERTY,
					requires: createDefaultRequires(),
					range: pos(propertyTarget),
				})
			}
			if (propOpTarget) {
				const propOpTargetParent = getParent(propOpTarget, parentMap)
				suggestions.push({
					...baseSuggestion,
					type: (propOpTargetParent as ConditionNode).sep
						? SUGGESTION_TYPE.EXPANDED_PROPERTY_OPERATOR
						: SUGGESTION_TYPE.CUSTOM_PROPERTY_OPERATOR
					,
					requires: createDefaultRequires(),
					range: pos(propOpTarget),
				})
			}

			const canSuggestValue =
				(
					(
						token.whitespace.next &&
						(
							token.whitespace.prev ||
							token.prev?.type === TOKEN_TYPE.BRACKETL ||
							token.prev?.type === TOKEN_TYPE.PARENL
						)
					) ||
					(
						token.whitespace.prev &&
						(
							token.whitespace.next ||
							token.next?.type === TOKEN_TYPE.BRACKETR ||
							token.next?.type === TOKEN_TYPE.PARENR
						)
					)
				)

			if (canSuggestValue) {
				const inArrayNode = [nextCondition, prevCondition, nextVar, prevVar].find(_ => _?.type === AST_TYPE.ARRAY) !== undefined
				const opsNotNeeded = ["and", "or"].includes(opts.onMissingBooleanOperator)


				if (inArrayNode || opsNotNeeded) {
					suggestions.push({
						type: inArrayNode ? SUGGESTION_TYPE.ARRAY_VALUE : SUGGESTION_TYPE.VARIABLE,
						requires: createDefaultRequires({}),
						range: pos({ start: index }, { fill: true }),
						...baseSuggestion,
					})
				}
				// if we're not an in array node we can also suggest prefixes
				if (!inArrayNode && opsNotNeeded) {
					suggestions.push({
						...baseSuggestion,
						type: SUGGESTION_TYPE.PREFIX,
						requires: createDefaultRequires({
							group: true,
						}),
						range: pos({ start: index }, { fill: true }),
					})
				}
			}
			const tokenAtParent = getParent(token.at, parentMap)
			const tokenValidPrevParent = getParent(token.valid.prev, parentMap)
			const tokenValidNextParent = getParent(token.valid.next, parentMap)
			const canSuggestRegexFlags =
				// has existing flags before/after
				(
					token.at &&
					token.at === (tokenAtParent as VariableNode)?.quote?.flags
				) ||
				(
					token.valid.prev &&
					token.valid.prev === (tokenValidPrevParent as VariableNode)?.quote?.flags
				) ||
				(
					token.valid.next &&
					token.valid.next === (tokenValidNextParent as VariableNode)?.quote?.flags
				) ||
				( // no flags
					token.valid.prev?.type === TOKEN_TYPE.REGEX &&
					token.valid.prev === (tokenValidPrevParent as VariableNode).quote?.right
				)

			if (canSuggestRegexFlags) {
				suggestions.push({
					...baseSuggestion,
					type: SUGGESTION_TYPE.REGEX_FLAGS,
					requires: createDefaultRequires(),
					range: pos({ start: index }, { fill: true }),
				})
			}

			if (canSuggestOpAfterPrev || canSuggestOpBeforeNext) {
				const range = pos({ start: index }, { fill: true })
				suggestions.push({
					...baseSuggestion,
					type: SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP,
					requires: createDefaultRequires(),
					range,
				})
				suggestions.push({
					...baseSuggestion,
					type: SUGGESTION_TYPE.BOOLEAN_WORD_OP,
					requires: createDefaultRequires({
						whitespace: {
							before: requiresWhitespacePrevOp,
							after: requireWhitespaceNextOp,
						},
					}),
					range,
				})
			}
		}
		return suggestions
	}

	/**
	 * Evaluates a {@link Parser.normalize normalized} ast.
	 *
	 * How the ast is evaluated for different operators can be controlled by the {@link ParserOptions.valueComparer valueComparer} option.
	 */
	evaluate(ast: NormalizedExpression<any, any> | NormalizedCondition<any, any>, context: Record<string, any>): boolean {
		this._checkEvaluationOptions()
		const opts = (this as any as Parser<T>).options

		if (ast.type === AST_TYPE.NORMALIZED_CONDITION) {
			const contextValue = get(context, ast.property)
			const res = opts.valueComparer(ast, contextValue, context)
			return ast.negate ? !res : res
		}
		if (ast.type === AST_TYPE.NORMALIZED_EXPRESSION) {
			const left = this.evaluate(ast.left, context)
			const right = this.evaluate(ast.right, context)

			return ast.operator === TOKEN_TYPE.AND
				? (left && right)
				: (left || right)
		}

		return unreachable()
	}

	/**
	 * Given the set of indexes returned by {@link getBestIndex}, the set of existing indexes in a database, and the index to sort by\*, will return a list of the best/shortest sets of indexes.
	 *
	 * For example, given the query `a && b && c`, `getBestIndex` will return `[Set(a), Set(b)]`.
	 *
	 * Suppose we have indexes on all the variables and that the user wants to sort by `c`, this function will return [`Set(c)`].
	 *
	 * Suppose instead we have indexes only on `a` and `b` and that the user wants to sort by `c`, this function will return [`Set(a), Set(b)`]. Either can be picked by some other criteria (e.g. size of the indexes). Sort should then be done in memory.
	 *
	 * And then finally, if we have no existing indexes on any of the variables, the function will return `[]`.
	 *
	 * Note: This is a simple algorithm and is not designed to take into account instances where entries are indexed by two or more properties as their keys (i.e. multicolumn indexes).
	 *
	 * \* If the sort index is not in the list of existing indexes it is not taken into account.
	 */
	getBestIndexes(indexes: Set<string>[], existing: Set<string> | Map<string, number>, sortIndex: string = ""): Set<string>[] {
		indexes = indexes.filter(set => {
			for (const key of set) {
				if (!existing.has(key)) return false
			}
			return true
		})

		let finalIndexes = indexes

		if (existing.has(sortIndex)) {
			const indexesWithSortIndex = indexes.filter(set => set.has(sortIndex))
			if (indexesWithSortIndex.length > 0) finalIndexes = indexesWithSortIndex
		}


		let smallest = Infinity
		if (existing instanceof Map) {
			const scores = new Map<Set<string>, number>()
			for (const set of finalIndexes) {
				let score = 0
				for (const key of set) {
					score += existing.get(key) ?? 0
				}
				scores.set(set, score)
				smallest = score < smallest ? score : smallest
			}
			return indexes.filter(set => smallest === Infinity || scores.get(set) === smallest)
		} else {
			for (const set of finalIndexes) {
				smallest = set.size < smallest ? set.size : smallest
			}
			return indexes.filter(set => smallest === Infinity || set.size === smallest)
		}
	}

	/**
	 * Returns a list of the different sets of keys that need to be indexed to run a normalized query on a database and hit an existing index.
	 *
	 * For example, the expression `a || b` requires both `a` AND `b` be indexed to use an index. The function would return `[Set(a, b)]`.
	 *
	 * On the otherhand, the expression `a && b` only requires `a` OR `b` to be indexed (`[Set(a), Set(b)]`) If at least one is indexed, the rest of the filtering can be done in memory. There is no need to in memory filter the entire database.
	 *
	 * Now take a more complicated query like `(a && b) || (a && c)`. This only requires `a` be indexed, or both `b` AND `c`. (`[Set(a)], [Set(b), Set(c)]`).
	 *
	 * Queries like `(a || b) && (a || c)` would require all the variables to be indexed `[Set(a), Set(b), Set(c)]`.
	 */
	getIndexes(ast: NormalizedCondition | NormalizedExpression): Set<string>[] {
		if (ast.type === AST_TYPE.NORMALIZED_CONDITION) {
			return [new Set(ast.property.join("."))]
		}
		if (ast.type === AST_TYPE.NORMALIZED_EXPRESSION) {
			const left = this.getIndexes(ast.left)
			const right = this.getIndexes(ast.right)

			if (ast.operator === TOKEN_TYPE.AND) {
				const sets: Set<string>[] = []
				const allKeys: Set<string> = new Set()

				for (const leftSet of left) {
					const exists = sets.find(set => isEqualSet(set, leftSet))
					if (exists) continue
					sets.push(leftSet)
					for (const key of leftSet) {
						allKeys.add(key)
					}
				}
				for (const rightSet of right) {
					const exists = sets.find(set => isEqualSet(set, rightSet))
					if (exists) continue
					sets.push(rightSet)
					for (const key of rightSet) {
						allKeys.add(key)
					}
				}

				const commonKeys: Set<string> = new Set()

				// eslint-disable-next-line no-labels
				outerCheck: for (const key of allKeys) {
					for (const set of sets) {
						// eslint-disable-next-line no-labels
						if (!set.has(key)) continue outerCheck
					}
					commonKeys.add(key)
				}
				if (commonKeys.size > 0) {
					return [commonKeys, allKeys]
				} else {
					return sets
				}
			}
			if (ast.operator === TOKEN_TYPE.OR) {
				for (const rightSet of right) {
					for (const leftSet of left) {
						if (isEqualSet(leftSet, rightSet)) {
							return [rightSet]
						}
					}
				}
				const res = new Set<string>()
				for (const leftSet of left) {
					for (const key of leftSet) {
						res.add(key)
					}
				}
				for (const rightSet of right) {
					for (const key of rightSet) {
						res.add(key)
					}
				}
				return [res]
			}
		}

		return unreachable()
	}

	/**
	 * Normalizes the ast by applying {@link GroupNode GroupNodes} and converting {@link ConditionNode ConditionNodes} to {@link NormalizedConditionNode NormalizedConditionNodes}.
	 */
	normalize<TType extends string, TValue>(ast: ParserResults): NormalizedCondition<TType, TValue> | NormalizedExpression<TType, TValue> {
		this._checkEvaluationOptions()
		const opts = (this as any as Parser<T>).options
		if (!ast.valid) {
			throw new Error("AST node must be valid.")
		}
		// eslint-disable-next-line prefer-rest-params
		const prefix: string | undefined = arguments[1]
		// eslint-disable-next-line prefer-rest-params
		const groupValue: boolean | undefined = arguments[2]
		// eslint-disable-next-line prefer-rest-params
		let operator: string | undefined = arguments[3]

		const self_ = this as any as Parser & { normalize: AddParameters<Parser["normalize"], [typeof prefix, typeof groupValue, typeof operator]> }

		if (ast.type === AST_TYPE.CONDITION) {
			if (!(ast.value.type === AST_TYPE.GROUP)) {
				const isValue = ast.value.type === AST_TYPE.ARRAY || (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				let name = ast.property?.value?.value
					? unescape(ast.property.value.value)
					: isValue
						// the property might be missing, whether this is valid or not is up to the user
						// e.g. if prefix is defined this would make some sense
						? undefined
						: unescape((ast.value as VariableNode)!.value!.value!)
				// some ancestor node went through the else block because it was a group node (e.g. prop:op(val))
				// so the "prefix" we passed is actually the name of the property (e.g. prop) and the value is the name we're getting here (e.g. val)
				const isNested = operator !== undefined
				if (prefix !== undefined && !isNested) {
					name = name ? applyPrefix(prefix, name, opts.prefixApplier) : prefix
				}

				let value: any
				if (isNested) {
					value = name ?? true
					name = prefix
				} else {
					value = ast.value.type === AST_TYPE.ARRAY
						? ast.value.values.map(val => unescape(val.value.value!))
						: (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
							? ast.value.value?.value
							: ast.property && ast.value.type === AST_TYPE.VARIABLE
								? unescape(ast.value.value.value!)
								: true
				}
				const propertyKeys = name ? opts.keyParser(name) : []

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				const valuePrefix = ast.value.type === AST_TYPE.VARIABLE && ast.value.prefix
					? unescape(ast.value.prefix.value)
					: undefined
				// one or the other might be defined, but never both since nested properties (e.g. `prop:op(prop:op(...))`) are not allowed
				operator ??= ast.propertyOperator?.value
				const isRegex = (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const isQuoted = (ast.value as VariableNode)?.quote !== undefined
				const isExpanded = ast.sep !== undefined
				const regexFlags = (ast.value as VariableNode)?.quote?.flags?.value
				const query: ValueQuery = {
					value,
					operator,
					prefix: valuePrefix,
					regexFlags,
					property: propertyKeys,
					isRegex,
					isQuoted,
					isExpanded,
					isNegated: !boolValue,
					condition: ast,
				}
				const res = opts.conditionNormalizer(query)
				return createCondition({ property: propertyKeys, ...res })
			} else {
				let name = unescape((ast.property as VariableNode).value.value!) // this is always a variable node
				if (prefix !== undefined) {
					name = applyPrefix(prefix, name, opts.prefixApplier)
				}
				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				// other operator is never defined see comments in other block above
				// eslint-disable-next-line @typescript-eslint/no-shadow
				const operator = ast.propertyOperator?.value
				// this call will at some point lead us to the above block with isNested = true
				return self_.normalize(ast.value, name, boolValue, operator) as any
			}
		}
		if (ast.type === AST_TYPE.GROUP) {
			const _prefix = ast.prefix?.type === AST_TYPE.CONDITION && ast.prefix?.value.type === AST_TYPE.VARIABLE
				? unescape(ast.prefix.value.value.value!)
				: undefined // we do not want to apply not tokens
			const isNotToken = _prefix === undefined

			const _groupValue = ast.prefix?.type === AST_TYPE.CONDITION
				? ast.prefix.operator === undefined
				: !(ast.prefix?.valid === true)

			// do not attempt to apply prefix if it's undefined (a not token)
			// otherwise we would get weird calls to applyPrefix
			const applied = isNotToken
				? prefix
				: applyPrefix(prefix, _prefix, opts.prefixApplier)

			return self_.normalize(ast.expression as any, applied, applyBoolean(groupValue, _groupValue), operator) as any
		}
		if (ast.type === AST_TYPE.EXPRESSION) {
			const left = self_.normalize(ast.left, prefix, groupValue, operator)
			const right = self_.normalize(ast.right, prefix, groupValue, operator)

			// apply De Morgan's laws if group prefix was negative
			// the values are already flipped, we just have to flip the operator
			const type: TokenBoolean = (groupValue === false ? OPPOSITE[ast.operator!.type!] : ast.operator.type)!
			return createExpression<TType, TValue>({ operator: type, left: left as any, right: right as any })
		}
		return unreachable()
	}

	/**
	 * Allows pre-validating ASTs for syntax highlighting purposes.
	 * Works similar to evaluate. Internally it will use the prefixApplier, keyParser, and valueValidator (instead of comparer).
	 *
	 * The context does not need to be passed. If it's not passed, the function will not attempt to get the values (so it will not error) and the contextValue param of the valueValidator will be undefined.
	 */
	validate(ast: ParserResults, context?: Record<string, any>): (Position & T)[] {
		const self = (this as any as Parser<T>)
		self._checkValidationOptions()
		const opts = self.options
		// see evaluate function, this method is practically identical, except we don't keep track of the real value (since we are not evaluating) and the actual nodes/tokens are passed to the valueValidator, not just the string values.
		if (!ast.valid) {
			throw new Error("AST node must be valid.")
		}
		/** Handle hidden recursive version of the function. */
		// eslint-disable-next-line prefer-rest-params
		const prefix: string | undefined = arguments[2]
		// eslint-disable-next-line prefer-rest-params
		const groupValue: boolean | undefined = arguments[3]
		// eslint-disable-next-line prefer-rest-params
		const results: (Position & T)[] = arguments[4] ?? []
		// eslint-disable-next-line prefer-rest-params
		const prefixes: VariableNode[] = arguments[5] ?? []
		// eslint-disable-next-line prefer-rest-params
		let operator: ValidToken<typeof TOKEN_TYPE.VALUE | typeof TOKEN_TYPE.OP_CUSTOM> | undefined = arguments[6]

		const self_ = this as any as Parser & { validate: AddParameters<Parser["validate"], [typeof prefix, typeof groupValue, typeof results, typeof prefixes, typeof operator]> }

		if (ast.type === AST_TYPE.CONDITION) {
			if (!(ast.value.type === AST_TYPE.GROUP)) {
				const isValue = ast.value.type === AST_TYPE.ARRAY || (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const nameNode = ast.property
					? ast.property as VariableNode
					: isValue
					? undefined
					: ast.value as VariableNode

				let name = nameNode ? unescape(nameNode.value.value!) : undefined
				const isNested = operator !== undefined
				if (prefix !== undefined && !isNested) {
					name = name ? applyPrefix(prefix, name, opts.prefixApplier) : prefix
				}
				let value: any
				let propertyNodes: VariableNode[] = []

				if (isNested) {
					value = name
					name = prefix
					propertyNodes = [...prefixes]
				} else {
					propertyNodes = [...prefixes, ...(nameNode ? [nameNode] : [])]
					value = ast.value.type === AST_TYPE.ARRAY
						? ast.value.values
						: (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
						? ast.value
						: ast.property && ast.value.type === AST_TYPE.VARIABLE
						? ast.value
						: true
				}
				const propertyKeys = name ? opts.keyParser(name) : []
				const contextValue = context !== undefined ? get(context, propertyKeys) : undefined

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)
				const valuePrefix = ast.value.type === AST_TYPE.VARIABLE && ast.value.prefix
					? ast.value.prefix
					: undefined
				operator ??= ast.propertyOperator as ValidToken<typeof TOKEN_TYPE.VALUE | typeof TOKEN_TYPE.OP_CUSTOM>
				const isRegex = (ast.value as VariableNode)?.quote?.left.type === TOKEN_TYPE.REGEX
				const isQuoted = (ast.value as VariableNode)?.quote !== undefined
				const isExpanded = ast.sep !== undefined
				const regexFlags = (ast.value as VariableNode)?.quote?.flags
				const query: ValidationQuery = {
					value,
					operator,
					prefix: valuePrefix,
					prefixes,
					property: propertyNodes,
					propertyKeys,
					propertyName: name,
					regexFlags,
					isRegex,
					isNegated: !boolValue,
					isQuoted,
					isExpanded,
					condition: ast,
				}
				const res = opts.valueValidator(contextValue, query, context)
				if (res && !isArray(res)) throw new Error("The valueValidator must return an array or nothing/undefined")
				if (res) { for (const entry of res) results.push(entry) }
			} else {
				let name = unescape((ast.property as VariableNode).value.value!) // this is always a variable node
				if (prefix !== undefined) {
					name = applyPrefix(prefix, name, opts.prefixApplier)
				}

				const boolValue = applyBoolean(groupValue, ast.operator === undefined)

				if (ast.property) prefixes.push((ast.property as any))
				// eslint-disable-next-line @typescript-eslint/no-shadow
				const operator = ast.propertyOperator as ValidToken<typeof TOKEN_TYPE.VALUE | typeof TOKEN_TYPE.OP_CUSTOM>
				self_.validate(ast.value, context, name, boolValue, results, prefixes, operator)
			}
		}

		if (ast.type === AST_TYPE.GROUP) {
			const _prefix = ast.prefix?.type === AST_TYPE.CONDITION && ast.prefix.value.type === AST_TYPE.VARIABLE
				? ast.prefix.value
				: undefined // we do not want to apply not tokens
			if (_prefix) prefixes.push(_prefix)

			const _groupValue = ast.prefix?.type === AST_TYPE.CONDITION
				? ast.prefix.operator === undefined
				: !(ast.prefix?.valid === true)

			self_.validate(ast.expression as any, context, applyPrefix(prefix, _prefix?.value.value ?? "", opts.prefixApplier), applyBoolean(groupValue, _groupValue), results, prefixes, operator)
		}
		if (ast.type === AST_TYPE.EXPRESSION) {
			// prefixes must be spread because we don't want the left branch (if it goes deeper) to affect the right
			self_.validate(ast.left, context, prefix, groupValue, results, [...prefixes], operator)
			self_.validate(ast.right, context, prefix, groupValue, results, [...prefixes], operator)
		}
		return results
	}
}

