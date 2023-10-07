/* eslint-disable camelcase */
import { escapeRegex, isBlank } from "@alanscodelog/utils"
import { createToken, Lexer, type TokenType } from "chevrotain"

import type { FullParserOptions } from "../types/parser.js"


/** Makes it easier to rename the tokens while still returning a properly typed record of them.*/
// eslint-disable-next-line @typescript-eslint/naming-convention
enum $T {
	_ = "_", // whitespace,
	ANY = "ANY",
	QUOTE_ANY = "QUOTE_ANY",
	QUOTE_SINGLE = "QUOTE_SINGLE",
	QUOTE_DOUBLE = "QUOTE_DOUBLE",
	QUOTE_BACKTICK = "QUOTE_BACKTICK",
	VALUE = "VALUE",
	REGEX_ANY = "REGEX_ANY",
	VALUE_UNQUOTED = "VALUE_UNQUOTED",
	BRACKET_VALUE_UNQUOTED = "BRACKET_VALUE_UNQUOTED",
	VALUE_REGEX = "VALUE_REGEX",
	VALUE_NOT_SINGLE = "VALUE_NOT_SINGLE",
	VALUE_NOT_DOUBLE = "VALUE_NOT_DOUBLE",
	VALUE_NOT_BACKTICK = "VALUE_NOT_BACKTICK",
	VALUE_FOR_SINGLE = "VALUE_FOR_SINGLE",
	VALUE_FOR_DOUBLE = "VALUE_FOR_DOUBLE",
	VALUE_FOR_BACKTICK = "VALUE_FOR_BACKTICK",
	OPERATOR_OR = "OPERATOR_OR",
	OPERATOR_AND = "OPERATOR_AND",
	OPERATOR_NOT = "OPERATOR_NOT",
	SYM_OR = "SYM_OR",
	SYM_AND = "SYM_AND",
	SYM_NOT = "SYM_NOT",
	WORD_OR = "WORD_OR",
	WORD_AND = "WORD_AND",
	WORD_NOT = "WORD_NOT",
	REGEX_START = "REGEX_START",
	REGEX_END = "REGEX_END",
	QUOTE_SINGLE_START = "QUOTE_SINGLE_START",
	QUOTE_DOUBLE_START = "QUOTE_DOUBLE_START",
	QUOTE_BACKTICK_START = "QUOTE_BACKTICK_START",
	QUOTE_SINGLE_END = "QUOTE_SINGLE_END",
	QUOTE_DOUBLE_END = "QUOTE_DOUBLE_END",
	QUOTE_BACKTICK_END = "QUOTE_BACKTICK_END",
	EXP_PROP_OP = "EXP_PROP_OP",
	CUSTOM_PROP_OP = "CUSTOM_PROP_OP",
	PAREN_L = "PAREN_L",
	PAREN_R = "PAREN_R",
	BRACKET_L = "BRACKET_L",
	BRACKET_R = "BRACKET_R",
}

// Should only be used internally by the lexer.
type LexerOnly =
	// | $T.ANY - special case, needed when we want to consume any token
	| $T.VALUE_NOT_BACKTICK
	| $T.VALUE_NOT_DOUBLE
	| $T.VALUE_NOT_SINGLE
	| $T.SYM_OR
	| $T.SYM_AND
	| $T.WORD_OR
	| $T.WORD_AND
	// | $T.REGEX_START - special case, needed for recovering
	| $T.REGEX_END
	| $T.QUOTE_SINGLE_START
	| $T.QUOTE_DOUBLE_START
	| $T.QUOTE_BACKTICK_START
	| $T.QUOTE_SINGLE_END
	| $T.QUOTE_DOUBLE_END
	| $T.QUOTE_BACKTICK_END
	| $T.WORD_NOT
	// | $T.SYM_NOT - special case, allowed because custom prop operators can be the "symbol" negation tokens

function clone(token: TokenType): TokenType {
	const t: any = {}
	if (token.name !== undefined) t.name = token.name
	if (token.CATEGORIES !== undefined) t.categories = token.CATEGORIES
	if (token.GROUP !== undefined) t.group = token.GROUP
	if (token.LINE_BREAKS !== undefined) t.line_breaks = token.LINE_BREAKS
	if (token.LONGER_ALT !== undefined) t.longet_alt = token.LONGER_ALT
	if (token.PATTERN !== undefined) t.pattern = token.PATTERN
	if (token.PUSH_MODE !== undefined) t.push_mode = token.PUSH_MODE
	if (token.POP_MODE !== undefined) t.pop_mode = token.POP_MODE
	return createToken(t)
}

function changePushMode(tokens: TokenType[], mode: string | undefined | ((str?: string) => string)): TokenType[] {
	return tokens.map(_ => clone({
		..._,
		...(mode ? { PUSH_MODE: typeof mode === "function" ? mode(_.PUSH_MODE) : mode } : {}),
	}))
}

export function createTokens<T extends {} = {}>(opts: FullParserOptions<T>): {
	tokens: Record<Exclude<$T, LexerOnly>, TokenType>
	lexer: Lexer
	info: {
		expandedSepAlsoCustom: boolean
		customOpAlsoNegation: boolean
	}
} {
	const $: Record<$T, TokenType> = {} as any

	/* #region  TOKEN CATEGORIES */

	$[$T.ANY] = createToken({
		name: $T.ANY,
		pattern: Lexer.NA,
	})
	$[$T.QUOTE_ANY] = createToken({
		name: $T.QUOTE_ANY,
		pattern: Lexer.NA,
	})

	// so we can easily match start/end tokens in wrong positions
	$[$T.QUOTE_SINGLE] = createToken({
		name: $T.QUOTE_SINGLE,
		pattern: Lexer.NA,
	})
	$[$T.QUOTE_DOUBLE] = createToken({
		name: $T.QUOTE_DOUBLE,
		pattern: Lexer.NA,
	})
	$[$T.QUOTE_BACKTICK] = createToken({
		name: $T.QUOTE_BACKTICK,
		pattern: Lexer.NA,
	})
	$[$T.REGEX_ANY] = createToken({
		name: $T.REGEX_ANY,
		pattern: Lexer.NA,
	})

	// required to make bracket values work
	// see the bracket modes at the end for an explanation
	$[$T.VALUE_FOR_SINGLE] = createToken({
		name: $T.VALUE_FOR_SINGLE,
		pattern: Lexer.NA,
	})
	$[$T.VALUE_FOR_DOUBLE] = createToken({
		name: $T.VALUE_FOR_DOUBLE,
		pattern: Lexer.NA,
	})
	$[$T.VALUE_FOR_BACKTICK] = createToken({
		name: $T.VALUE_FOR_BACKTICK,
		pattern: Lexer.NA,
	})

	$[$T.OPERATOR_OR] = createToken({
		name: $T.OPERATOR_OR,
		pattern: Lexer.NA,
	})
	$[$T.OPERATOR_AND] = createToken({
		name: $T.OPERATOR_AND,
		pattern: Lexer.NA,
	})
	$[$T.OPERATOR_NOT] = createToken({
		name: $T.OPERATOR_NOT,
		pattern: Lexer.NA,
	})

	$[$T.VALUE] = createToken({
		name: $T.VALUE,
		pattern: Lexer.NA,
	})
	/* #regionend */
	/* #region ACTUAL TOKENS */

	$[$T._] = createToken({
		name: $T._,
		pattern: /\s+/,
		group: Lexer.SKIPPED,
		line_breaks: true,
	})


	$[$T.REGEX_START] = createToken({
		name: $T.REGEX_START,
		push_mode: "notRegex",
		pattern: /\//,
		categories: [$[$T.REGEX_ANY], $[$T.ANY]],
	})
	$[$T.REGEX_END] = createToken({
		name: $T.REGEX_END,
		push_mode: "main",
		pattern: /\/[a-z]*/,
		categories: [$[$T.REGEX_ANY], $[$T.ANY]],
	})
	$[$T.VALUE_REGEX] = createToken({
		name: $T.VALUE_REGEX,
		push_mode: "regexEnd",
		line_breaks: true,
		categories: [$[$T.ANY]],
		pattern: {
			exec: (text, start) => {
				let end = start
				let inGroup = 0
				let char = text[end]
				let prevEscaped = false
				while (char !== undefined && (char !== "/" || inGroup > 0 || prevEscaped)) {
					if (char === "[") inGroup++
					// normally something like /][/ will error, but we pretend the initial "negative" ] are ignored so things like /][]/ won't
					if (char === "]" && inGroup > 0) inGroup--
					if (char === "\\") {
						if (!prevEscaped) {
							prevEscaped = true
						} else {
							prevEscaped = false
						}
					} else {
						prevEscaped &&= false
					}
					end++
					char = text[end]
				}
				if (start === end) return null
				return [text.substring(start, end)]
			},
		},
	})


	$[$T.QUOTE_SINGLE_START] = createToken({
		name: $T.QUOTE_SINGLE_START,
		pattern: /'/,
		push_mode: "notSingle",
		categories: [$[$T.QUOTE_SINGLE], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.QUOTE_DOUBLE_START] = createToken({
		name: $T.QUOTE_DOUBLE_START,
		pattern: /"/,
		push_mode: "notDouble",
		categories: [$[$T.QUOTE_DOUBLE], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.QUOTE_BACKTICK_START] = createToken({
		name: $T.QUOTE_BACKTICK_START,
		pattern: /`/,
		push_mode: "notBacktick",
		categories: [$[$T.QUOTE_BACKTICK], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.QUOTE_SINGLE_END] = createToken({
		name: $T.QUOTE_SINGLE_END,
		pattern: /'/,
		push_mode: "main",
		categories: [$[$T.QUOTE_SINGLE], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.QUOTE_DOUBLE_END] = createToken({
		name: $T.QUOTE_DOUBLE_END,
		pattern: /"/,
		push_mode: "main",
		categories: [$[$T.QUOTE_DOUBLE], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.QUOTE_BACKTICK_END] = createToken({
		name: $T.QUOTE_BACKTICK_END,
		pattern: /`/,
		push_mode: "main",
		categories: [$[$T.QUOTE_BACKTICK], $[$T.QUOTE_ANY], $[$T.ANY]],
	})
	$[$T.VALUE_NOT_SINGLE] = createToken({
		name: $T.VALUE_NOT_SINGLE,
		pattern: /(\\[\s\S]|[^'])+/,
		push_mode: "endQuotes",
		categories: [$[$T.VALUE], $[$T.VALUE_FOR_SINGLE], $[$T.ANY]],
		line_breaks: true,
	})
	$[$T.VALUE_NOT_DOUBLE] = createToken({
		name: $T.VALUE_NOT_DOUBLE,
		pattern: /(\\[\s\S]|[^"])+/,
		push_mode: "endQuotes",
		categories: [$[$T.VALUE], $[$T.VALUE_FOR_DOUBLE], $[$T.ANY]],
		line_breaks: true,
	})
	$[$T.VALUE_NOT_BACKTICK] = createToken({
		name: $T.VALUE_NOT_BACKTICK,
		pattern: /(\\[\s\S]|[^`])+/,
		push_mode: "endQuotes",
		categories: [$[$T.VALUE], $[$T.VALUE_FOR_BACKTICK], $[$T.ANY]],
		line_breaks: true,
	})

	const symOrs = opts.keywords.or.filter(_ => _.isSymbol).map(_ => escapeRegex(_.value))
	const symAnds = opts.keywords.and.filter(_ => _.isSymbol).map(_ => escapeRegex(_.value))
	const symNots = opts.keywords.not.filter(_ => _.isSymbol).map(_ => escapeRegex(_.value))
	const wordOrs = opts.keywords.or.filter(_ => !_.isSymbol).map(_ => escapeRegex(_.value))
	const wordAnds = opts.keywords.and.filter(_ => !_.isSymbol).map(_ => escapeRegex(_.value))
	const wordNots = opts.keywords.not.filter(_ => !_.isSymbol).map(_ => escapeRegex(_.value))
	let syms = [...symOrs, ...symAnds, ...symNots]

	const customPropertyOperators = (opts.customPropertyOperators ?? []).map(_ => escapeRegex(_))

	const expandedPropertySeparator = escapeRegex(opts.expandedPropertySeparator ?? "")

	if (expandedPropertySeparator) syms.push(expandedPropertySeparator)
	if (customPropertyOperators) syms = syms.concat(customPropertyOperators)
	if (opts.regexValues) syms.push("\\/")
	if (opts.arrayValues) {
		syms.push("\\[")
		// [ makes the lexer enter a bracket value, but ] should not be ignored by VALUE_UNQUOTED in case we get input like just `]` or `...]` which should be parsed as values
	}

	// future change to custom pattern, should be faster
	$[$T.VALUE_UNQUOTED] = createToken({
		name: $T.VALUE_UNQUOTED,
		pattern: new RegExp(`(\\\\[\\s\\S]|(${syms.length > 0 ? `(?!(${syms.join("|")}))` : ``}[^ \\t()'"\`\\\\]))+`),
		push_mode: "endQuotes",
		categories: [$[$T.VALUE], $[$T.ANY]],
	})

	$[$T.BRACKET_VALUE_UNQUOTED] = createToken({
		name: $T.BRACKET_VALUE_UNQUOTED,
		pattern: /(\\[\s\S]|([^ \]\\t'"`\\]))+/,
		push_mode: "bracket_endQuotes",
		categories: [$[$T.VALUE], $[$T.ANY]],
	})

	// operators are only added if they're enabled, otherwise cheverotain will complain about empty regex expressions
	const operators = []

	$[$T.SYM_OR] = createToken({
		name: $T.SYM_OR,
		pattern: new RegExp(`(${symOrs.join("|")})`),
		categories: [$[$T.OPERATOR_OR], $[$T.ANY]],
	})
	if (symOrs.length > 0) operators.push($[$T.SYM_OR])

	$[$T.SYM_AND] = createToken({
		name: $T.SYM_AND,
		pattern: new RegExp(`(${symAnds.join("|")})`),
		categories: [$[$T.OPERATOR_AND], $[$T.ANY]],
	})
	if (symAnds.length > 0) operators.push($[$T.SYM_AND])

	$[$T.SYM_NOT] = createToken({
		name: $T.SYM_NOT,
		pattern: new RegExp(`(${symNots.join("|")})`),
		categories: [$[$T.OPERATOR_NOT], $[$T.ANY]],
	})
	if (symNots.length > 0) operators.push($[$T.SYM_NOT])

	$[$T.WORD_OR] = createToken({
		name: $T.WORD_OR,
		pattern: new RegExp(`(${wordOrs.join("|")})`),
		longer_alt: $[$T.VALUE_UNQUOTED],
		categories: [$[$T.OPERATOR_OR], $[$T.ANY]],
	})
	if (wordOrs.length > 0) operators.push($[$T.WORD_OR])

	$[$T.WORD_AND] = createToken({
		name: $T.WORD_AND,
		pattern: new RegExp(`(${wordAnds.join("|")})`),
		longer_alt: $[$T.VALUE_UNQUOTED],
		categories: [$[$T.OPERATOR_AND], $[$T.ANY]],
	})
	if (wordAnds.length > 0) operators.push($[$T.WORD_AND])

	$[$T.WORD_NOT] = createToken({
		name: $T.WORD_NOT,
		pattern: new RegExp(`(${wordNots.join("|")})`),
		longer_alt: $[$T.VALUE_UNQUOTED],
		categories: [$[$T.OPERATOR_NOT], $[$T.ANY]],
	})
	if (wordNots.length > 0) operators.push($[$T.WORD_NOT])


	/* region Operators */
	$[$T.EXP_PROP_OP] = createToken({
		name: $T.EXP_PROP_OP,
		pattern: new RegExp(`${expandedPropertySeparator}`),
		categories: [$[$T.ANY]],
	})

	if (!isBlank(expandedPropertySeparator)) operators.splice(0, 0, $[$T.EXP_PROP_OP])

	$[$T.CUSTOM_PROP_OP] = createToken({
		name: $T.CUSTOM_PROP_OP,
		pattern: new RegExp(`(${customPropertyOperators.join("|")})`),
		categories: [$[$T.ANY]],
	})

	// only add custom operator if it's pattern doesn't match the not or expanded operator separator patterns (which can be the same)
	// otherwise chevrotain will complain when the regex patterns match exactly
	const customOpEqualsExpandedOrNegationToken = [$[$T.SYM_NOT].PATTERN, $[$T.EXP_PROP_OP].PATTERN]
		.find(_ => _?.toString() === $[$T.CUSTOM_PROP_OP].PATTERN?.toString()) !== undefined

	if (
		(customPropertyOperators?.length ?? 0) > 0 &&
		!customOpEqualsExpandedOrNegationToken
	) operators.splice(1, 0, $[$T.CUSTOM_PROP_OP])


	// for parser
	const expandedSepAlsoCustom = customPropertyOperators.includes(expandedPropertySeparator)
	const customOpAlsoNegation = symNots.length > 0 &&
		customPropertyOperators?.find(_ => symNots.includes(_)) !== undefined
	/* regionend */


	$[$T.PAREN_L] = createToken({
		name: $T.PAREN_L,
		pattern: /\(/,
		categories: [$[$T.ANY]],
	})
	$[$T.PAREN_R] = createToken({
		name: $T.PAREN_R,
		pattern: /\)/,
		categories: [$[$T.ANY]],
	})
	const parens = [$[$T.PAREN_L], $[$T.PAREN_R]]
	// they still need to be defined for the parser, but if opts.arrayValues is false, they're never in any of the lexer modes
	$[$T.BRACKET_L] = createToken({
		name: $T.BRACKET_L,
		pattern: /\[/,
		push_mode: "bracket_main",
		categories: [$[$T.ANY]],
	})
	$[$T.BRACKET_R] = createToken({
		name: $T.BRACKET_R,
		pattern: /\]/,
		push_mode: "main",
		categories: [$[$T.ANY]],
	})

	const quotes = [
		$[$T.QUOTE_SINGLE_START],
		$[$T.QUOTE_DOUBLE_START],
		$[$T.QUOTE_BACKTICK_START],
	]

	const quotesEnds = [
		$[$T.QUOTE_SINGLE_END],
		$[$T.QUOTE_DOUBLE_END],
		$[$T.QUOTE_BACKTICK_END],
	]

	/* #regionend */


	const toBracket = (mode?: string): string => `bracket_${mode!}`
	const lexerOptions = {
		modes: {
			main: [
				$[$T._],
				...parens,
				...(opts.arrayValues ? [$[$T.BRACKET_L]] : []), // moves to bracket_main until a bracket pops it back out
				...operators,
				...quotes, // moves to not*
				...(opts.regexValues ? [$[$T.REGEX_START]] : []), // moves to notRegex
				$[$T.VALUE_UNQUOTED], // moves to maybeQuoteError
			],
			endQuotes: [
				$[$T._],
				...parens,
				...(opts.arrayValues ? [$[$T.BRACKET_L]] : []), // moves to bracket_main until a bracket pops it back out to main
				...operators,
				...quotesEnds,
				$[$T.VALUE_UNQUOTED], // moves to maybeQuoteError
				...(opts.regexValues ? [$[$T.REGEX_START]] : []), // error
			],
			// we can have situations like `a"` where the left quote is missing
			// we want the quote to match a quote end so that it pushes the state to main again, instead of shifting how everything is parsed
			maybeQuoteError: [
				...quotesEnds,
				...(opts.regexValues ? [$[$T.REGEX_END]] : []),
			],
			// all move to endQuotes
			notSingle: [$[$T.VALUE_NOT_SINGLE], $[$T.QUOTE_SINGLE_END]],
			notDouble: [$[$T.VALUE_NOT_DOUBLE], $[$T.QUOTE_DOUBLE_END]],
			notBacktick: [$[$T.VALUE_NOT_BACKTICK], $[$T.QUOTE_BACKTICK_END]],
			...(opts.regexValues
				? {
					notRegex: [
						$[$T.VALUE_REGEX],
						$[$T.REGEX_END], // regex is empty
					], // moves to regexEnd
					regexEnd: [$[$T.REGEX_END]], // moves to main
				} : {}),
			...(opts.arrayValues
				? {
					bracket_main: [
						...changePushMode(quotes, toBracket),
						$[$T.BRACKET_R], // move back to main
						$[$T.BRACKET_VALUE_UNQUOTED],
					],
					// all the following follow the same logic as the non-bracket modes, except operators and parens and regexes are not supported and are just parsed as values with BRACKET_VALUE_UNQUOTED
					// the following tokens are also cloned to push differently: quotes (above), quote values, and quote ends
					// they can still be matched because their parent categories are also cloned and it's those we match against
					bracket_endQuotes: [
						$[$T._],
						...changePushMode(quotesEnds, toBracket),
						$[$T.BRACKET_R], // move back to main
						$[$T.BRACKET_VALUE_UNQUOTED],
					],
					bracket_maybeQuoteError: changePushMode(quotesEnds, toBracket),
					bracket_notSingle: changePushMode([
						$[$T.VALUE_NOT_SINGLE], $[$T.QUOTE_SINGLE_END],
					], toBracket),
					bracket_notDouble: changePushMode([
						$[$T.VALUE_NOT_DOUBLE], $[$T.QUOTE_DOUBLE_END],
					], toBracket),
					bracket_notBacktick: changePushMode([
						$[$T.VALUE_NOT_BACKTICK], $[$T.QUOTE_BACKTICK_END],
					], toBracket),
				} : {}
			),

		},
		defaultMode: "main",
	}

	const lexer = new Lexer(lexerOptions) // only because we don't care about newlines
	return { tokens: $, lexer, info: { expandedSepAlsoCustom, customOpAlsoNegation } }
}

