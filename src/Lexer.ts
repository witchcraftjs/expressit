import { isBlank } from "@alanscodelog/utils/isBlank.js"
import { pushIfNotIn } from "@alanscodelog/utils/pushIfNotIn.js"

import { checkParserOpts } from "./internal/checkParserOpts.js"
import { parseParserOptions } from "./internal/parseParserOptions.js"
import type { FullParserOptions } from "./types/index.js"

const regexFlags = /^[a-zA-Z]+/

enum MODE {
	MAIN = "MAIN",
	MAYBE_QUOTE_ERROR = "MAYBE_QUOTE_ERROR",
	NOT_SINGLE = "NOT_SINGLE",
	NOT_DOUBLE = "NOT_DOUBLE",
	NOT_BACKTICK = "NOT_BACKTICK",
	NOT_REGEX = "NOT_REGEX",
	REGEX_END = "REGEX_END",
	BRACKET_MAIN = "BRACKET_MAIN",
	BRACKET_MAYBE_QUOTE_ERROR = "BRACKET_MAYBE_QUOTE_ERROR",
	BRACKET_NOT_SINGLE = "BRACKET_NOT_SINGLE",
	BRACKET_NOT_DOUBLE = "BRACKET_NOT_DOUBLE",
	BRACKET_NOT_BACKTICK = "BRACKET_NOT_BACKTICK",
	
}
const BRACKET_PREFIX = "BRACKET"

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum $T {
	_ = "_", // whitespace,
	VALUE_UNQUOTED = "VALUE_UNQUOTED",
	VALUE_REGEX = "VALUE_REGEX",
	VALUE_NOT_SINGLE = "VALUE_NOT_SINGLE",
	VALUE_NOT_DOUBLE = "VALUE_NOT_DOUBLE",
	VALUE_NOT_BACKTICK = "VALUE_NOT_BACKTICK",
	SYM_OR = "SYM_OR",
	SYM_AND = "SYM_AND",
	SYM_NOT = "SYM_NOT",
	WORD_OR = "WORD_OR",
	WORD_AND = "WORD_AND",
	WORD_NOT = "WORD_NOT",
	REGEX_START = "REGEX_START",
	REGEX_END = "REGEX_END",
	EXP_PROP_OP = "EXP_PROP_OP",
	CUSTOM_PROP_OP = "CUSTOM_PROP_OP",
	PAREN_L = "PAREN_L",
	PAREN_R = "PAREN_R",
	BRACKET_L = "BRACKET_L",
	BRACKET_R = "BRACKET_R",
	QUOTE_SINGLE = "QUOTE_SINGLE",
	QUOTE_DOUBLE = "QUOTE_DOUBLE",
	QUOTE_BACKTICK = "QUOTE_BACKTICK",
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum $C {
	ANY = "ANY",
	QUOTE_ANY = "QUOTE_ANY",
	REGEX_ANY = "REGEX_ANY",
	VALUE_FOR_SINGLE = "VALUE_FOR_SINGLE",
	VALUE_FOR_DOUBLE = "VALUE_FOR_DOUBLE",
	VALUE_FOR_BACKTICK = "VALUE_FOR_BACKTICK",
	OPERATOR_OR = "OPERATOR_OR",
	OPERATOR_AND = "OPERATOR_AND",
	OPERATOR_NOT = "OPERATOR_NOT",
	VALUE = "VALUE",
}
	

type SymbolInfo = {
	symOrs: string[]
	symAnds: string[]
	symNots: string[]
	wordOrs: string[]
	wordAnds: string[]
	wordNots: string[]
	all: string[]
	expandedSepAlsoCustom: boolean
	customOpAlsoNegation: boolean
}

type TokenMatchFunc = (c: string, input: string, start: number, mode: string) => string | boolean

interface BaseTokenType<T extends $T | $C> {
	type: T
	skip?: boolean
}
export interface RealTokenType<
	T extends $T = $T,
	TPush extends string | undefined = undefined,
	// TCategories extends $C[] | undefined = undefined,
> extends BaseTokenType<T> {
	matches: TokenMatchFunc
	push?: TPush | ((mode: string, tokens: Token[]) => TPush)
	// categories?: TCategories
	longerAlt?: $T
	skip?: boolean
}
export interface TokenCategoryType<
	TC extends $C,
	TTokens extends RealTokenType<$T, any>[] = RealTokenType<$T, any>[],
> extends BaseTokenType<TC> {
	isCategory: true
	entries: Partial<{[ key in TTokens[number]["type"]]: TTokens[number] }>
	// entries: Partial<Record<TTokens[number]["type"], TTokens[number]>>
}

export type TokenType<TC extends $C | $T> = TC extends $T
? RealTokenType<TC, any>
: TC extends $C
? TokenCategoryType<TC>
: never

function createTokenCategoryType<T extends $C, TTokens extends RealTokenType<$T, any>>(
	type: T,
	entries: (TTokens | undefined)[],
): TokenCategoryType<T, TTokens[]> {
	return {
		type,
		isCategory: true,
		entries: Object.fromEntries(
			entries.filter(_ => _ !== undefined)
				.map(_ => [_!.type, _!]),
		) as any,
	}
}

function createTokenType<
	T extends $T,
	TPush extends string | undefined = undefined,
>(
	type: T,
	opts: Omit<RealTokenType<T, TPush>, "type">,
): RealTokenType<T, TPush > {
	return {
		type,
		...opts,
	}
}
function matchWhileCharNotEqualToUnescaped(char: string) {
	return (c: string, input: string, start: number): string | false => {
		let end = start
		while (c !== undefined && c !== char) {
			if (c === "\\") {
				end += 2
				c = input[end]
				continue
			}
			end++
			c = input[end]
		}
		if (start === end) return false
		return input.slice(start, end)
	}
}
function matchSymbol(symbols: string[]): TokenMatchFunc {
	return (_c: string, input: string, start: number): string | false => {
		for (const sym of symbols) {
			const textSlice = input.slice(start, start + sym.length)
			if (textSlice === sym) {
				return textSlice
			}
		}
		return false
	}
}

export interface Token<T extends $T | $C = $T | $C> {
	type: T
	value: string
	startOffset: number
	endOffset: number
	isError?: boolean
}

export class Lexer {
	symbols: SymbolInfo

	$: {[key in $T]: RealTokenType<key, any> }

	$categories: ReturnType<Lexer["createTokens"]>["$categories"]

	branches: {[key in keyof typeof MODE]?: TokenType<$T>[] }

	opts: FullParserOptions<{}>

	constructor(
		opts: Partial<FullParserOptions<{}>> = {},
	) {
		this.opts = parseParserOptions(opts)
		checkParserOpts(this.opts)
		this.symbols = this.calculateSymbolInfo()
		const tokenTypes = this.createTokens() as any
		this.$ = tokenTypes.$
		this.$categories = tokenTypes.$categories
		this.branches = this.createModeBranches()
	}

	calculateSymbolInfo(): SymbolInfo {
		const opts = this.opts
		const symOrs = opts.keywords.or.filter(_ => _.isSymbol).map(_ => _.value)
		const symAnds = opts.keywords.and.filter(_ => _.isSymbol).map(_ => _.value)
		const symNots = opts.keywords.not.filter(_ => _.isSymbol).map(_ => _.value)
		const wordOrs = opts.keywords.or.filter(_ => !_.isSymbol).map(_ => _.value)
		const wordAnds = opts.keywords.and.filter(_ => !_.isSymbol).map(_ => _.value)
		const wordNots = opts.keywords.not.filter(_ => !_.isSymbol).map(_ => _.value)
		const syms: string[] = [...symOrs, ...symAnds, ...symNots]

		const customPropertyOperators = opts.customPropertyOperators ?? []

		const expandedPropertySeparator = opts.expandedPropertySeparator ?? ""

		if (expandedPropertySeparator) syms.push(expandedPropertySeparator)
		if (customPropertyOperators.length > 0) pushIfNotIn(syms, customPropertyOperators)
		if (opts.regexValues) syms.push("\\/")
		if (opts.arrayValues) {
			syms.push("\\[")
			// [ makes the lexer enter a bracket value, but ] should not be ignored by VALUE_UNQUOTED in case we get input like just `]` or `...]` which should be parsed as values
		}
		
		const symbols = {
			// all sorted by longest first, so longest matches are matched first
			symOrs: symOrs.sort((a, b) => b.length - a.length),
			symAnds: symAnds.sort((a, b) => b.length - a.length),
			symNots: symNots.sort((a, b) => b.length - a.length),
			wordOrs: wordOrs.sort((a, b) => b.length - a.length),
			wordAnds: wordAnds.sort((a, b) => b.length - a.length),
			wordNots: wordNots.sort((a, b) => b.length - a.length),
			all: syms.sort((a, b) => b.length - a.length),
		}

		const expandedSepAlsoCustom = opts.customPropertyOperators?.includes(opts.expandedPropertySeparator as any) ?? false
		let customOpAlsoNegation = false
		if (symbols.symNots.length > 0) {
			for (const op of opts.customPropertyOperators ?? []) {
				for (const sym of symbols.symNots) {
					if (op === sym) {
						customOpAlsoNegation = true
						break
					}
					// if (op.startsWith(sym)) {
					// 	customOpAlsoNegation = true
					// 	break
					// }
				}
			}
		}
		// symbols.symNots.length > 0 &&
		// opts.customPropertyOperators?.find(_ => symbols.symNots.includes(_)) !== undefined

		return { ...symbols, expandedSepAlsoCustom, customOpAlsoNegation }
	}

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	createTokens() {
		const opts = this.opts
		const symbols = this.symbols
		
		const $ = {
			[$T._]: createTokenType($T._, {
				skip: true,
				matches: (c, input, start) => {
					let end = start
					while (
					c === " "
					|| c === "\t"
					|| c === "\n"
					|| c === "\r"
					|| c === "\v"
					|| c === "\f"
					) {
						end++
						c = input[end]
					}
					if (start === end) return false
					return input.slice(start, end)
				},
			}),
			[$T.REGEX_START]: createTokenType($T.REGEX_START, {
				push: MODE.NOT_REGEX,
				matches: (c: string) => c === "/",
			}),
			[$T.REGEX_END]: createTokenType($T.REGEX_END, {
				push: MODE.MAIN,
				matches: (c, input, start) => {
					let end = start
					if (c === "/") {
						end++
						c = input[end]
						const match = regexFlags.exec(input.slice(end))
						if (match !== null) {
							end += match.input.length
						}
						return input.slice(start, end)
					} else return false
				},
			}),
			[$T.VALUE_REGEX]: createTokenType($T.VALUE_REGEX, {
				push: MODE.REGEX_END,
				matches: (c, input, start) => {
					let end = start
					let inGroup = 0
					let prevEscaped = false
					while (c !== undefined && (c !== "/" || inGroup > 0 || prevEscaped)) {
						if (c === "[") inGroup++
						// normally something like /][/ will error, but we pretend the initial "negative" ] are ignored so things like /][]/ won't
						if (c === "]" && inGroup > 0) inGroup--
						if (c === "\\") {
							if (!prevEscaped) {
								prevEscaped = true
							} else {
								prevEscaped = false
							}
						} else {
							prevEscaped &&= false
						}
						end++
						c = input[end]
					}
					if (start === end) return false
					return input.slice(start, end)
				},
			}),
			[$T.QUOTE_SINGLE]: createTokenType($T.QUOTE_SINGLE, {
				push: (mode, tokens) => {
					const previous = tokens[tokens.length - 2]
					if (
						/**
						 * If we  just matched a quote and the previous token was the inside of a quote then we are at the end of the quoted value.
						 * Go back to main instead of searching for the quoted value
						 * Otherwise input like 'a'b'c' will trap us in a MAIN <=> NOT_SINGLE loop.
						 */
						previous?.type === $T.VALUE_NOT_SINGLE
						/* Similarly, if the previous token was an unquoted value, we have a quote error.*/
						|| previous?.type === $T.VALUE_UNQUOTED) {
						if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
						return MODE.MAIN
					}
					switch (mode) {
						case MODE.BRACKET_MAIN:
							return MODE.BRACKET_NOT_SINGLE
						case MODE.MAIN:
							return MODE.NOT_SINGLE
						default:
							if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
							return MODE.MAIN
					}
				},
				matches: c => c === "'",
			}),
			[$T.QUOTE_DOUBLE]: createTokenType($T.QUOTE_DOUBLE, {
				push: (mode, tokens) => {
					const previous = tokens[tokens.length - 2]
					if (previous?.type === $T.VALUE_NOT_DOUBLE || previous?.type === $T.VALUE_UNQUOTED) {
						if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
						return MODE.MAIN
					}
					switch (mode) {
						case MODE.BRACKET_MAIN:
							return MODE.BRACKET_NOT_DOUBLE
						case MODE.MAIN:
							return MODE.NOT_DOUBLE
						default:
							if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
							return MODE.MAIN
					}
				},
				matches: c => c === "\"",
			}),
			[$T.QUOTE_BACKTICK]: createTokenType($T.QUOTE_BACKTICK, {
				push: (mode, tokens) => {
					const previous = tokens[tokens.length - 2]
					if (previous?.type === $T.VALUE_NOT_BACKTICK || previous?.type === $T.VALUE_UNQUOTED) {
						if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
						return MODE.MAIN
					}
					switch (mode) {
						case MODE.BRACKET_MAIN:
							return MODE.BRACKET_NOT_BACKTICK
						case MODE.MAIN:
							return MODE.NOT_BACKTICK
						default:
							if (mode.startsWith(BRACKET_PREFIX)) return MODE.BRACKET_MAIN
							return MODE.MAIN
					}
				},
				matches: c => c === "`",
			}),
			[$T.VALUE_NOT_SINGLE]: createTokenType($T.VALUE_NOT_SINGLE, {
				push: mode => mode.startsWith(BRACKET_PREFIX) ? MODE.BRACKET_MAIN : MODE.MAIN,
				matches: matchWhileCharNotEqualToUnescaped("'"),
			}),
			[$T.VALUE_NOT_DOUBLE]: createTokenType($T.VALUE_NOT_DOUBLE, {
				push: mode => mode.startsWith(BRACKET_PREFIX) ? MODE.BRACKET_MAIN : MODE.MAIN,
				matches: matchWhileCharNotEqualToUnescaped("\""),
			}),
			[$T.VALUE_NOT_BACKTICK]: createTokenType($T.VALUE_NOT_BACKTICK, {
				push: mode => mode.startsWith(BRACKET_PREFIX) ? MODE.BRACKET_MAIN : MODE.MAIN,
				matches: matchWhileCharNotEqualToUnescaped("`"),
			}),
			[$T.VALUE_UNQUOTED]: createTokenType($T.VALUE_UNQUOTED, {
				push: mode => mode.startsWith(BRACKET_PREFIX) ? MODE.BRACKET_MAIN : MODE.MAIN,
				// manual version of pattern: /(\\[\s\S]|(${syms.length > 0 ? `(?!(${syms.join("|")}))` : ``}[^ \t()'"`\\]))+/,
				matches: (c, input, start, mode) => {
					let end = start
					while (c !== undefined) {
						if (c === "\\") {
							end += 2 // skip the escape character
							c = input[end]
							continue
						}
						if (mode === MODE.MAIN) {
							let found = false
							for (const sym of symbols.all) {
								const textSlice = input.slice(end, end + sym.length)
								if (textSlice === sym) {
									found = true
									break
								}
							}
							if (found) break
						}
						if (c === " "
						|| c === "\t"
						|| c === "("
						|| c === ")"
						|| c === "'"
						|| c === "\""
						|| c === "`"
						|| c === "\\"
						|| (mode === MODE.BRACKET_MAIN && c === "]")
						) {
							break
						}
						end++
						c = input[end]
					}
					if (start === end) return false
					return input.slice(start, end)
				},
			}),
			...(symbols.symOrs.length > 0 ? {
				[$T.SYM_OR]: createTokenType($T.SYM_OR, {
					matches: matchSymbol(symbols.symOrs),
				}),
			} : {}),
			...(symbols.symAnds.length > 0 ? {
				[$T.SYM_AND]: createTokenType($T.SYM_AND, {
					matches: matchSymbol(symbols.symAnds),
				}),
			} : {}),
			...(symbols.symNots.length > 0 ? {
				[$T.SYM_NOT]: createTokenType($T.SYM_NOT, {
					matches: matchSymbol(symbols.symNots),
				}),
			} : {}),

			...(symbols.wordOrs.length > 0 ? {
				[$T.WORD_OR]: createTokenType($T.WORD_OR, {
					matches: matchSymbol(symbols.wordOrs),
					longerAlt: $T.VALUE_UNQUOTED,
				}),
			} : {}),
			...(symbols.wordAnds.length > 0 ? {
				[$T.WORD_AND]: createTokenType($T.WORD_AND, {
					matches: matchSymbol(symbols.wordAnds),
					longerAlt: $T.VALUE_UNQUOTED,
				}),
			} : {}),
			...(symbols.wordNots.length > 0 ? { [$T.WORD_NOT]: createTokenType($T.WORD_NOT, {
				matches: matchSymbol(symbols.wordNots),
				longerAlt: $T.VALUE_UNQUOTED,
			}) } : {}),
			...(!isBlank(opts.expandedPropertySeparator ?? "") ? {
				[$T.EXP_PROP_OP]: createTokenType($T.EXP_PROP_OP, {
					matches: (_c, input, start) => {
						for (const op of opts.expandedPropertySeparator!) {
							const chars = input.slice(start, start + op.length)
							if (chars === op) return op
						}
						return false
					},
				}),
			} : {}),
			...((opts.customPropertyOperators?.length ?? 0) > 0 && !symbols.customOpAlsoNegation ? {
				[$T.CUSTOM_PROP_OP]: createTokenType($T.CUSTOM_PROP_OP, {
					matches: (_c, input, start) => {
					// todo sort by length
						for (const op of opts.customPropertyOperators ?? []) {
							const chars = input.slice(start, start + op.length)
							if (chars === op) return op
						}
						return false
					},
				}),
			} : {}),
			[$T.PAREN_L]: createTokenType($T.PAREN_L, {
				matches: c => c === "(",
			}),
			[$T.PAREN_R]: createTokenType($T.PAREN_R, {
				matches: c => c === ")",
			}),
			[$T.BRACKET_L]: createTokenType($T.BRACKET_L, {
				push: MODE.BRACKET_MAIN,
				matches: c => c === "[",
			}),
			[$T.BRACKET_R]: createTokenType($T.BRACKET_R, {
				push: MODE.MAIN,
				matches: c => c === "]",
			}),
		}
		const $categories = {
			[$C.ANY]: createTokenCategoryType($C.ANY, [
				$[$T.REGEX_START],
				$[$T.REGEX_END],
				$[$T.QUOTE_SINGLE],
				$[$T.QUOTE_DOUBLE],
				$[$T.QUOTE_BACKTICK],
				$[$T.VALUE_NOT_SINGLE],
				$[$T.VALUE_NOT_DOUBLE],
				$[$T.VALUE_NOT_BACKTICK],
				$[$T.VALUE_UNQUOTED],
				$[$T.SYM_OR],
				$[$T.SYM_AND],
				$[$T.SYM_NOT],
				$[$T.WORD_OR],
				$[$T.WORD_AND],
				$[$T.WORD_NOT],
				$[$T.EXP_PROP_OP],
				$[$T.CUSTOM_PROP_OP],
				$[$T.PAREN_L],
				$[$T.PAREN_R],
				$[$T.BRACKET_L],
				$[$T.BRACKET_R],
			] as const),
			[$C.VALUE]: createTokenCategoryType($C.VALUE, [
				$[$T.VALUE_UNQUOTED],
				$[$T.VALUE_NOT_SINGLE],
				$[$T.VALUE_NOT_DOUBLE],
				$[$T.VALUE_NOT_BACKTICK],
			] as const),
			[$C.VALUE_FOR_SINGLE]: createTokenCategoryType($C.VALUE_FOR_SINGLE, [
				$[$T.VALUE_NOT_SINGLE],
			] as const),
			[$C.VALUE_FOR_DOUBLE]: createTokenCategoryType($C.VALUE_FOR_DOUBLE, [
				$[$T.VALUE_NOT_DOUBLE],
			] as const),
			[$C.VALUE_FOR_BACKTICK]: createTokenCategoryType($C.VALUE_FOR_BACKTICK, [
				$[$T.VALUE_NOT_BACKTICK],
			] as const),
			[$C.REGEX_ANY]: createTokenCategoryType($C.REGEX_ANY, [
				$[$T.REGEX_START],
				$[$T.REGEX_END],
			] as const),
			[$C.QUOTE_ANY]: createTokenCategoryType($C.QUOTE_ANY, [
				$[$T.QUOTE_SINGLE],
				$[$T.QUOTE_DOUBLE],
				$[$T.QUOTE_BACKTICK],
			] as const),
			[$C.OPERATOR_OR]: createTokenCategoryType($C.OPERATOR_OR, [
				$[$T.SYM_OR],
				$[$T.WORD_OR],
			] as const),
			[$C.OPERATOR_AND]: createTokenCategoryType($C.OPERATOR_AND, [
				$[$T.SYM_AND],
				$[$T.WORD_AND],
			] as const),
			[$C.OPERATOR_NOT]: createTokenCategoryType($C.OPERATOR_NOT, [
				$[$T.SYM_NOT],
				$[$T.WORD_NOT],
			] as const),
		}
		return { $, $categories }
	}

	createModeBranches(): {[key in keyof typeof MODE]?: TokenType<$T>[] } {
		const opts = this.opts
		const $ = this.$
		const quotes = [
			$[$T.QUOTE_SINGLE],
			$[$T.QUOTE_DOUBLE],
			$[$T.QUOTE_BACKTICK],
		] as const

		const parens = [$[$T.PAREN_L], $[$T.PAREN_R]]
		const operators = ([
			$[$T.EXP_PROP_OP],
			$[$T.CUSTOM_PROP_OP],
			$[$T.SYM_OR],
			$[$T.SYM_AND],
			$[$T.SYM_NOT],
			$[$T.WORD_OR],
			$[$T.WORD_AND],
			$[$T.WORD_NOT],
		] as const).filter(_ => _ !== undefined)

		return {
			[MODE.MAIN]: [
				$[$T._],
				...parens,
				...(opts.arrayValues ? [$[$T.BRACKET_L]] : []), // => MODE.BRACKET_MAIN
				...operators,
				...quotes, // => MODE.NOT_*
				...(opts.regexValues ? [$[$T.REGEX_START]] : []), // => MODE.NOT_REGEX
				$[$T.VALUE_UNQUOTED],
			],
			// this is just MAIN by another name, but allows us to properly distinguish start/end quotes
			
			// // we can have situations like `a"` where the left quote is missing
			// // we want the quote to match a quote so that it pushes the state to main again, instead of shifting how everything is parsed
			[MODE.MAYBE_QUOTE_ERROR]: [
				...quotes,
				...(opts.regexValues ? [$[$T.REGEX_END]] : []),
			],
			// all => MODE.MAIN
			[MODE.NOT_SINGLE]: [$[$T.VALUE_NOT_SINGLE], $[$T.QUOTE_SINGLE]],
			[MODE.NOT_DOUBLE]: [$[$T.VALUE_NOT_DOUBLE], $[$T.QUOTE_DOUBLE]],
			[MODE.NOT_BACKTICK]: [$[$T.VALUE_NOT_BACKTICK], $[$T.QUOTE_BACKTICK]],
			...(opts.regexValues
				? {
					[MODE.NOT_REGEX]: [
						$[$T.VALUE_REGEX],
						$[$T.REGEX_END], // regex is empty
					], // => MODE.REGEX_END
					[MODE.REGEX_END]: [$[$T.REGEX_END]], // => MODE.MAIN
				} : {}),
			...(opts.arrayValues
				? {
					[MODE.BRACKET_MAIN]: [
						$[$T._],
						...quotes,
						$[$T.BRACKET_R], // => MODE.MAIN
						$[$T.VALUE_UNQUOTED],
					],
					
					// all the following follow the same logic as the non-bracket modes, except operators and parens and regexes are not supported and are just parsed as values with VALUE_UNQUOTED
					[MODE.BRACKET_MAYBE_QUOTE_ERROR]: [...quotes],
					[MODE.BRACKET_NOT_SINGLE]: [
						$[$T.VALUE_NOT_SINGLE],
						$[$T.QUOTE_SINGLE],
					],
					[MODE.BRACKET_NOT_DOUBLE]: [
						$[$T.VALUE_NOT_DOUBLE],
						$[$T.QUOTE_DOUBLE],
					],
					[MODE.BRACKET_NOT_BACKTICK]: [
						$[$T.VALUE_NOT_BACKTICK],
						$[$T.QUOTE_BACKTICK],
					],
				} : {}
			),
		}
	}
	
	
	tokenize(input: string): Token<$T>[] {
		const branches = this.createModeBranches()
		const tokens: Token<$T>[] = []
		let mode = MODE.MAIN
		let index = 0
		let c = input[index]
		let branch = branches[mode] as any as TokenType<$T>[]
		while (index < input.length) {
			for (const t of branch) {
				let match = t.matches(c, input, index, mode)
				if (match) {
					let matchLength = match === true ? 1 : (match as string).length
					let type = t.type
					if (t.longerAlt) {
						const longerMatch = this.$[t.longerAlt].matches(c, input, index, mode)
						const longerMatchLength = longerMatch === true ? 1 : (longerMatch as string).length
						
						if (longerMatch && longerMatchLength > matchLength) {
							match = longerMatch
							matchLength = longerMatchLength
							type = t.longerAlt
						}
					}
					const newIndex = index + matchLength
					const val = match === true ? c : match
					const token = createToken(type, val, index, newIndex - 1)
					if (!t.skip) tokens.push(token)
					if (t.push) {
						mode = typeof t.push === "function"
							? t.push(mode, tokens)
							: t.push
						branch = branches[mode] as any
					}
					index = newIndex
					c = input[index]
					break
				}
			}
		}
		return tokens
	}
}
function createToken<T extends $T>(type: T, value: string, startOffset: number, endOffset: number): Token<T> {
	return {
		type,
		value,
		startOffset,
		endOffset,
	}
}

