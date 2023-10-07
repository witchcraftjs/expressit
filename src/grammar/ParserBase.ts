/* eslint-disable @typescript-eslint/naming-convention */

import { isArray, unreachable } from "@alanscodelog/utils"
import { EmbeddedActionsParser, EOF, type IToken, tokenMatcher } from "chevrotain"

import type { createTokens } from "./createTokens.js"

import { pos } from "../ast/builders/pos.js"
import { ArrayNode } from "../ast/classes/ArrayNode.js"
import { ConditionNode } from "../ast/classes/ConditionNode.js"
import { ErrorToken } from "../ast/classes/ErrorToken.js"
import type { ExpressionNode } from "../ast/classes/ExpressionNode.js"
import type { GroupNode } from "../ast/classes/GroupNode.js"
import type { ValidToken } from "../ast/classes/ValidToken.js"
import { VariableNode } from "../ast/classes/VariableNode.js"
import * as handle from "../ast/handlers.js"
import { extractPosition } from "../helpers/parser/extractPosition.js"
import { Parser } from "../parser.js"
import { type AnyToken, type ParserResults, type Position, TOKEN_TYPE, type TokenQuoteTypes } from "../types/ast.js"
import type { FullParserOptions } from "../types/parser.js"


function processToken<TDefined extends boolean = boolean>(token: IToken, shift: number): [TDefined extends true ? string : string | undefined, Position] {
	let val: string | undefined = token.image
	if (token.isInsertedInRecovery) val = undefined
	return [val as any, extractPosition(token, shift)]
}
export class ParserBase<T extends {} = {}> extends EmbeddedActionsParser {
	rawInput!: string

	private subParser?: Parser

	private subParser2?: Parser

	constructor(opts: FullParserOptions<T>, t: ReturnType<typeof createTokens>["tokens"], { customOpAlsoNegation, expandedSepAlsoCustom }: ReturnType<typeof createTokens>["info"]) {
		super(t, {
			recoveryEnabled: true,
			// skipValidations: true
		})

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const $ = this

		$.RULE("main", () => {
			const res = $.SUBRULE($.boolOr)
			$.CONSUME(EOF)

			return $.ACTION(() => {
				if (res === undefined) {
					const error = handle.token.value(undefined, { start: 0, end: 0 })
					return error
				}
				return res
			})
		})
		$.RULE("boolOr", () => {
			const pairs: any[][] = []

			const DEF = (): void => {
				const exp = $.SUBRULE2($.boolAnd)
				const extras: any[] = []

				let next = $.LA(1)
				$.OPTION1({
					GATE: () => opts.onMissingBooleanOperator === "or" &&
						(
							tokenMatcher(next, t.VALUE) ||
							tokenMatcher(next, t.QUOTE_ANY) ||
							tokenMatcher(next, t.PAREN_L) ||
							tokenMatcher(next, t.EXP_PROP_OP) ||
							tokenMatcher(next, t.REGEX_START) ||
							tokenMatcher(next, t.CUSTOM_PROP_OP)
						),
					DEF: () => {
						let dummyOp
						const cond = $.SUBRULE3($.condition)
						$.ACTION(() => {
							// the operator is missing between the previous token and this exp
							const prev = $.LA(-1)
							const start = prev.endOffset! + 1
							dummyOp = handle.operator.or("", pos({ start }, { fill: true }))
						})

						extras.push([dummyOp, cond])
					},
				})

				next = $.LA(1)
				pairs.push([exp, tokenMatcher(next, t.OPERATOR_OR) ? handle.operator.or(...processToken<true>(next, $.shift)) : undefined])
				for (const extra of extras) {
					pairs[pairs.length - 1].splice(1, 1, extra[0])
					pairs.push([extra[1]])
				}
			}

			$.MANY_SEP({ SEP: t.OPERATOR_OR, DEF })


			$.OPTION({
				// many sep sometimes fails to recover when it technically could
				GATE: () => pairs.length === 0 && tokenMatcher($.LA(1), t.OPERATOR_OR),
				DEF: () => {
					$.MANY(() => {
						const next = $.CONSUME(t.OPERATOR_OR)
						pairs.push([undefined, handle.operator.or(...processToken<true>(next, $.shift))])
						while (tokenMatcher($.LA(1), t.VALUE) || tokenMatcher($.LA(1), t.QUOTE_ANY) || tokenMatcher($.LA(1), t.PAREN_L)) {
							pairs.push([$.SUBRULE3($.condition)])
						}
					})
				},
			})

			return $.ACTION(() => {
				let res = pairs[pairs.length - 1][0]
				for (let i = pairs.length - 1; i > 0; i--) {
					const before = pairs[i - 1]
					if (res === undefined && before === undefined) return undefined
					res = handle.expression(before[0], before[1], res)
				}
				return res
			})
		})
		$.RULE("boolAnd", () => {
			const pairs: any[][] = []

			const DEF = (): void => {
				const exp = $.SUBRULE2($.condition)
				const extras: any[][] = []

				let next = $.LA(1)
				$.OPTION1({
					GATE: () => ["error", "and"].includes(opts.onMissingBooleanOperator) &&
						(
							tokenMatcher(next, t.VALUE) ||
							tokenMatcher(next, t.QUOTE_ANY) ||
							tokenMatcher(next, t.PAREN_L) ||
							tokenMatcher(next, t.EXP_PROP_OP) ||
							tokenMatcher(next, t.REGEX_START) ||
							tokenMatcher(next, t.CUSTOM_PROP_OP)
						),
					DEF: () => {
						$.MANY2(() => {
							let dummyOp
							const cond = $.SUBRULE3($.condition)
							$.ACTION(() => {
								if (opts.onMissingBooleanOperator === "and") {
									// the operator is missing between the previous token and this exp
									const prev = $.LA(-1)
									const start = prev.endOffset! + 1
									dummyOp = handle.operator.and("", pos({ start }, { fill: true }))
								}
							})

							extras.push([dummyOp, cond])
						})
					},
				})

				next = $.LA(1)
				pairs.push([exp, tokenMatcher(next, t.OPERATOR_AND) ? handle.operator.and(...processToken<true>(next, $.shift)) : undefined])
				for (const extra of extras) {
					pairs[pairs.length - 1].splice(1, 1, extra[0])
					pairs.push([extra[1]])
				}
			}

			$.MANY_SEP({ SEP: t.OPERATOR_AND, DEF })


			$.OPTION({
				GATE: () => pairs.length === 0 && tokenMatcher($.LA(1), t.OPERATOR_AND),
				DEF: () => {
					$.MANY(() => {
						const next = $.CONSUME(t.OPERATOR_AND)
						pairs.push([undefined, handle.operator.and(...processToken<true>(next, $.shift))])
						while (tokenMatcher($.LA(1), t.VALUE) || tokenMatcher($.LA(1), t.QUOTE_ANY) || tokenMatcher($.LA(1), t.PAREN_L)) {
							pairs.push([$.SUBRULE3($.condition)])
						}
					})
				},
			})

			return $.ACTION(() => {
				if (pairs.length === 0) return undefined // handle situations like `a ||` where b is missing
				let res = pairs[pairs.length - 1][0]
				for (let i = pairs.length - 1; i > 0; i--) {
					const before = pairs[i - 1]
					res = handle.expression(before[0], before[1], res)
				}
				return res
			})
		})

		$.RULE("condition", () => {
			const not = $.OPTION(() => $.SUBRULE($.not))

			const property = $.OPTION2({
				GATE: () => (
					tokenMatcher($.LA(1), t.EXP_PROP_OP) ||
					tokenMatcher($.LA(1), t.CUSTOM_PROP_OP) ||
					tokenMatcher($.LA(2), t.EXP_PROP_OP) ||
					tokenMatcher($.LA(2), t.CUSTOM_PROP_OP) ||
					(
						customOpAlsoNegation &&
						(
							tokenMatcher($.LA(2), t.SYM_NOT) ||
							(tokenMatcher($.LA(0), t.SYM_NOT) && tokenMatcher($.LA(1), t.SYM_NOT))
						)
					)
				),
				DEF: () => $.SUBRULE($.property),
			}) as ReturnType<typeof $["property"]> | undefined
			const propVal = $.ACTION(() => property?.prop?.value === undefined
				? undefined
				: property.prop.value instanceof ErrorToken
					? ""
					: property.prop.value.value)

			const propOpVal = $.ACTION(() => property?.rest.propertyOperator === undefined
				? undefined
				: property.rest.propertyOperator instanceof ErrorToken
					? ""
					: property.rest.propertyOperator.value)

			const isExpanded = $.ACTION(() => (property?.rest.sepL ?? property?.rest.sepR) !== undefined)
			const convertRegexValues = $.ACTION(() =>
				typeof opts.regexValues === "function" && !opts.regexValues(propVal, propOpVal, isExpanded))

			const convertArrayValues = $.ACTION(() =>
				typeof opts.arrayValues === "function" && !opts.arrayValues(propVal, propOpVal, isExpanded))


			let value: ReturnType<typeof $["plainGroup"]> |
			ReturnType<typeof $["plainBracketGroup"]> |
			ReturnType<typeof $["variable"]> |
			undefined = $.OR2([
				{
					GATE: () => opts.prefixableGroups && property === undefined &&
							$.LA(1).tokenType !== t.PAREN_L && // moves to parsing group below
							(
								(
									tokenMatcher($.LA(1), t.VALUE) &&
									(
										tokenMatcher($.LA(2), t.PAREN_L) || // a(
										(tokenMatcher($.LA(2), t.QUOTE_ANY) && tokenMatcher($.LA(3), t.PAREN_L)) // a"(
									)
								) ||
								(
									tokenMatcher($.LA(1), t.QUOTE_ANY) &&
									(
										tokenMatcher($.LA(2), t.PAREN_L) || // "(
										(tokenMatcher($.LA(2), t.VALUE) &&
											(
												tokenMatcher($.LA(3), t.PAREN_L) || // "a(
												(tokenMatcher($.LA(3), t.QUOTE_ANY) && tokenMatcher($.LA(4), t.PAREN_L)) // "a"(
											)
										)
									)
								)

							)
					,
					ALT: () => $.SUBRULE<any, any>($.variable, { ARGS: [{ unprefixed: true }]}), // un-prefixed
				},
				{
					GATE: () => $.LA(1).tokenType !== t.PAREN_L,
					ALT: () => $.SUBRULE2($.variable),
				},
				{
					GATE: () => $.LA(1).tokenType === t.PAREN_L,
					ALT: () => $.SUBRULE2<any, any>($.plainGroup, { ARGS: [{ onlyValues: property !== undefined, convertRegexValues, convertArrayValues }]}),
				},
				{
					GATE: () => $.LA(1).tokenType === t.BRACKET_L,
					ALT: () => $.SUBRULE2<any, any>($.plainBracketGroup, { ARGS: [{ convertArrayValues }]}),
				},
				{
					GATE: () => not !== undefined || property !== undefined || $.LA(1).tokenType === EOF,
					ALT: () => undefined,
				},
			])

			let group = $.OPTION3({
				GATE: () => !(value instanceof ArrayNode) && !isArray(value) && (!value || opts.prefixableGroups) && $.LA(1).tokenType === t.PAREN_L, // is not already plain group
				DEF: () => $.SUBRULE3<any, any>($.plainGroup, { ARGS: [{ onlyValues: property !== undefined, convertRegexValues, convertArrayValues }]}),
			})


			return $.ACTION(() => {
				if (isArray(value)) {
					group = value
					value = undefined
				}

				if (convertRegexValues && value instanceof VariableNode && value.quote?.left.type === TOKEN_TYPE.REGEX) {
					value = handle.variable(undefined, undefined, handle.token.value(
						(value.quote?.left?.value ?? "") + (value.value.value ?? "") + (value.quote?.right?.value ?? ""),
						pos(value)
					), undefined) as ReturnType<this["variable"]>
				}
				if (group) {
					if (property) {
						// @ts-expect-error group is spreadable
						return handle.condition(not, property?.prop, property?.rest, handle.group(undefined, undefined, ...group))
					}
					if (value) {
						// @ts-expect-error group is spreadable
						return handle.group(undefined, handle.condition(not, undefined, undefined, value), ...group)
					}
					// @ts-expect-error group is spreadable
					return handle.group(not, value, ...group)
				}
				if ([not, property, value].every(_ => _ === undefined)) return undefined
				return handle.condition(not, property?.prop, property?.rest, value)
			})
		})

		$.RULE("property", () => {
			const prop: any = $.OPTION3(() => $.SUBRULE<any, any>($.variable, { ARGS: [{ unprefixed: true }]}))

			const rest = $.OR([
				{
					ALT: () => {
						let sepL: any = $.CONSUME(t.EXP_PROP_OP)
						sepL &&= handle.token.sep(...processToken(sepL, $.shift))

						let op: any = $.OPTION4(() => $.CONSUME2(t.VALUE_UNQUOTED))
						op &&= handle.token.value(...processToken(op, $.shift))

						let sepR: any = $.OPTION5(() => $.CONSUME2(t.EXP_PROP_OP))
						sepR &&= handle.token.sep(...processToken(sepR, $.shift))
						if (expandedSepAlsoCustom && op === undefined && sepR === undefined) {
							op = sepL
							op.type = TOKEN_TYPE.OP_CUSTOM
							sepL = undefined
						}
						return { sepL, sepR, propertyOperator: op }
					},
				},
				{
					ALT: () => {
						let op: any = $.CONSUME(t.CUSTOM_PROP_OP)
						if (!op.isInsertedInRecovery) op = handle.token.custom(...processToken(op, $.shift))
						return { propertyOperator: op }
					},
				},
				{
					GATE: () => customOpAlsoNegation,
					ALT: () => {
						let op: any = $.CONSUME2(t.SYM_NOT)
						if (!op.isInsertedInRecovery) op = handle.token.custom(...processToken(op, $.shift))
						return { propertyOperator: op }
					},
				},
			])

			return { prop, rest }
		})
		$.RULE("plainGroup", (
			{ onlyValues = false, convertRegexValues = false, convertArrayValues = false }:
			{ onlyValues?: boolean, convertRegexValues?: boolean, convertArrayValues?: boolean } = {}) => {
			const parenL = $.SUBRULE1($.parenL)
			let parenLeftCount = 0
			let start: undefined | number
			let end: undefined | number
			const condition = $.OPTION1({
				GATE: () => !onlyValues,
				DEF: () => $.SUBRULE1($.boolOr),
			})

			// bypasses self analysis (which goes into an infinite loop for some reason...)
			// see subParser hack below for why
			if (onlyValues && $.LA(1).tokenType !== EOF) {
				while (
					!tokenMatcher($.LA(1), EOF) &&
					(!tokenMatcher($.LA(1), t.PAREN_R) || parenLeftCount !== 0)
				) {
					const token = $.CONSUME(t.ANY)

					start ??= extractPosition(token, this.shift).start
					if (tokenMatcher(token, t.PAREN_L)) {
						parenLeftCount++
					}
					if (tokenMatcher(token, t.PAREN_R)) {
						parenLeftCount--
					}
				}
			}

			if (start !== undefined) {
				end ??= extractPosition($.LA(0), this.shift).end
			}

			const parenR = $.OPTION2(() => $.SUBRULE1($.parenR))
			return $.ACTION(() => {
				if (start !== undefined) {
					/**
					 * This is a bit of a hack to ignore forbidden expressions in groups when used as values (it would make no sense to do something like `prop:op(prop:op(...)))` or `prop:op:(prefix(...))`).
					 *
					 * Doing this from the tokenizer is very complicated because it would require keeping track of a lot of state since we need to know when a group follows something that even looks like a property/operator.
					 *
					 * This way we just consume all input until the correct next matching paren (or EOF) and re-parse it with a restricted version of the parser.
					 *
					 * Performance wise this should not be a problem since at most we add the time of one initialization per Parser/ParserBase class instance and only on demand. After that the parser is re-used when needed for any future parse calls. Additionally it only needs to be called once for the outer group used in a property value (i.e. `prop:OP:((()))` will only cause a single "sub parse").
					 */
					const subInput = this.rawInput.slice(start, end)

					if (this.subParser === undefined) {
						this.subParser = new Parser({
							...opts,
							customPropertyOperators: [],
							expandedPropertySeparator: undefined,
							regexValues: convertRegexValues,
							arrayValues: convertArrayValues,
						})
					}
					// @ts-expect-error extra param
					const parsed = this.subParser.parse(" ".repeat(start) + subInput, { unsealed: true })
					return [parenL, parsed, parenR]
				}
				// return parsed
				return [parenL, condition, parenR]
			})
		})
		$.RULE("plainBracketGroup", (
			{ convertArrayValues = false }:
			{ convertArrayValues?: boolean } = {}
		) => {
			const bracketL = $.SUBRULE1($.bracketL)
			const start = bracketL.start
			const values: any[] = []
			$.MANY({
				GATE: () => !convertArrayValues,
				DEF: () => values.push($.SUBRULE<any, any>($.variable, { ARGS: [{ unprefixed: false, bracketVal: true }]})),
			})
			// bypasses self analysis (which goes into an infinite loop for some reason...)
			// see subParser hack below for why
			if (convertArrayValues && $.LA(1).tokenType !== EOF) {
				while (
					!tokenMatcher($.LA(1), EOF) &&
					!tokenMatcher($.LA(1), t.BRACKET_R)
				) {
					$.CONSUME(t.ANY)
				}
			}
			const bracketR = $.OPTION2(() => $.SUBRULE1($.bracketR))
			const end = bracketR?.end

			return $.ACTION(() => {
				if (!convertArrayValues) return handle.array(bracketL, values, bracketR)
				/**
				 * Similar problem as with regex values above.
				 */
				const subInput = this.rawInput.slice(start, end)

				if (this.subParser2 === undefined) {
					this.subParser2 = new Parser({
						...opts,
						customPropertyOperators: [],
						expandedPropertySeparator: undefined,
						arrayValues: false,
					})
				}
				// @ts-expect-error extra param
				const parsed = this.subParser2.parse(" ".repeat(start) + subInput, { unsealed: true })

				if (parsed instanceof ConditionNode) {
					return parsed.value
				}
				return parsed
			})
		})

		$.RULE("not", () => {
			const op = $.CONSUME(t.OPERATOR_NOT)
			return $.ACTION(() => handle.operator.not(...processToken<true>(op, $.shift)))
		})

		$.RULE("variable", (
			{ unprefixed = false, bracketVal = false }:
			{ unprefixed?: boolean, bracketVal?: boolean } = {}
		) => {
			let prefix: any = $.OPTION({
				GATE: () => !unprefixed && opts.prefixableStrings !== undefined &&
					tokenMatcher($.LA(2), t.QUOTE_ANY) &&
					tokenMatcher($.LA(4), $.LA(2).tokenType) &&
					opts.prefixableStrings.includes($.LA(1).image),
				DEF: () => $.SUBRULE7<any, any>($.valueUnquoted, { ARGS: [{ bracketVal, onlyToken: true }]}),
			})


			prefix &&= handle.token.value(...processToken(prefix, $.shift))

			const ARGS = [{ bracketVal }]
			const val = $.OR([
				{
					ALT: () => {
						const quoteL = $.SUBRULE($.quoteDouble)
						const value = $.OPTION1(() => $.OR1([
							{ ALT: () => $.SUBRULE<any, any>($.valueUnquoted, { ARGS }) },
							{ ALT: () => $.SUBRULE($.valueNotDouble) },
						]))
						const quoteR = $.SUBRULE2($.quoteDouble)
						return $.ACTION(() => handle.variable(prefix, quoteL, value, quoteR))
					},
				},
				{
					ALT: () => {
						const quoteL = $.SUBRULE($.quoteSingle)
						const value = $.OPTION2(() => $.OR2([
							{ ALT: () => $.SUBRULE2<any, any>($.valueUnquoted, { ARGS }) },
							{ ALT: () => $.SUBRULE($.valueNotSingle) },
						]))
						const quoteR = $.SUBRULE2($.quoteSingle)
						return $.ACTION(() => handle.variable(prefix, quoteL, value, quoteR))
					},
				},
				{
					ALT: () => {
						const quoteL = $.SUBRULE($.quoteBacktick)
						const value = $.OPTION3(() => $.OR3([
							{ ALT: () => $.SUBRULE3<any, any>($.valueUnquoted, { ARGS }) },
							{ ALT: () => $.SUBRULE($.valueNotBacktick) },
						]))
						const quoteR = $.SUBRULE2($.quoteBacktick)
						return $.ACTION(() => handle.variable(prefix, quoteL, value, quoteR))
					},
				},
				{
					ALT: () => {
						const quoteL = $.SUBRULE($.regexAny) as ValidToken<TOKEN_TYPE.REGEX> // the start can never match flags
						// unlike other values, regexes will swallow all input if incorrect
						const value = $.OPTION4(() => $.SUBRULE5($.valueRegex))
						const quoteR = $.OPTION5(() => $.SUBRULE5($.regexAny))
						return $.ACTION(() => {
							const args = isArray(quoteR) ? quoteR : [quoteR] as [typeof quoteR]
							return handle.variable(undefined, quoteL, value, args[0], args[1])
						})
					},
				},
				{ // error
					ALT: () => {
						const value = $.SUBRULE4<any, any>($.valueUnquoted, { ARGS })
						const quoteR = $.SUBRULE4($.valueDelimAny)
						return $.ACTION(() => handle.variable(undefined, undefined, value, quoteR))
					},
				},
				{ // error
					ALT: () => {
						const quoteL = $.SUBRULE5($.valueDelimAny)
						const value = $.OPTION6(() => $.SUBRULE5<any, any>($.valueUnquoted, { ARGS }))
						return $.ACTION(() => handle.variable(undefined, quoteL, value, undefined))
					},
				},
				{
					ALT: () => {
						const value = $.SUBRULE6<any, any>($.valueUnquoted, { ARGS })
						return $.ACTION(() => handle.variable(undefined, undefined, value, undefined))
					},
				},
			])
			return val
		})

		$.RULE("valueDelimAny", () => {
			const value = $.CONSUME(t.QUOTE_ANY)
			return $.ACTION(() => {
				const type = value.image === `"`
					? "double"
					: value.image === "'"
						? "single"
						: value.image === "\\"
							? "regex"
							: value.image === "`"
								? "tick"
								: unreachable()
				return handle.delimiter[type](...processToken(value, $.shift))
			})
		})
		$.RULE("regexAny", () => {
			const value = $.CONSUME(t.REGEX_ANY)
			return $.ACTION(() => {
				if (value.image.length > 1) {
					// cheat a bit to extract the flags
					const delim = {
						image: "/",
						startOffset: value.startOffset,
						endOffset: value.startOffset,
					}
					const flags = {
						image: value.image.slice(1),
						startOffset: value.startOffset + 1,
						endOffset: value.endOffset,
					}
					return [
						handle.delimiter.regex(...processToken(delim as IToken, $.shift)),
						handle.token.value(...processToken(flags as IToken, $.shift)),
					]
				}
				return handle.delimiter.regex(...processToken(value, $.shift))
			})
		})
		$.RULE("valueRegex", () => {
			const value = $.CONSUME(t.VALUE_REGEX)
			return $.ACTION(() => handle.token.value(...processToken(value, $.shift)))
		})
		$.RULE("quoteSingle", () => {
			const value = $.CONSUME(t.QUOTE_SINGLE)
			return $.ACTION(() => handle.delimiter.single(...processToken(value, $.shift)))
		})
		$.RULE("quoteDouble", () => {
			const value = $.CONSUME(t.QUOTE_DOUBLE)
			return $.ACTION(() => handle.delimiter.double(...processToken(value, $.shift)))
		})
		$.RULE("quoteBacktick", () => {
			const value = $.CONSUME(t.QUOTE_BACKTICK)
			return $.ACTION(() => handle.delimiter.tick(...processToken(value, $.shift)))
		})
		$.RULE("valueNotSingle", () => {
			const value = $.CONSUME(t.VALUE_FOR_SINGLE)
			return $.ACTION(() => handle.token.value(...processToken(value, $.shift)))
		})
		$.RULE("valueNotDouble", () => {
			const value = $.CONSUME(t.VALUE_FOR_DOUBLE)
			return $.ACTION(() => handle.token.value(...processToken(value, $.shift)))
		})
		$.RULE("valueNotBacktick", () => {
			const value = $.CONSUME(t.VALUE_FOR_BACKTICK)
			return $.ACTION(() => handle.token.value(...processToken(value, $.shift)))
		})
		$.RULE("valueUnquoted", (
			{ bracketVal = false, onlyToken = false }:
			{ bracketVal?: boolean, onlyToken?: boolean } = {}
		) => {
			const value: any = $.OR([
				{
					GATE: () => !bracketVal,
					ALT: () => $.CONSUME(t.VALUE_UNQUOTED),
				},
				{
					GATE: () => bracketVal,
					ALT: () => $.CONSUME(t.BRACKET_VALUE_UNQUOTED),
				},
			])
			return $.ACTION(() => onlyToken ? value : handle.token.value(...processToken(value, $.shift)))
		})
		$.RULE("parenL", () => {
			const value = $.CONSUME(t.PAREN_L)

			return $.ACTION(() => {
				// magic, see parse
				const loc = extractPosition(value, $.shift)
				return $.shift === 0 || loc.start > 0
					? handle.delimiter.parenL(value.isInsertedInRecovery ? undefined : value.image, loc)
					: undefined
			})
		})
		$.RULE("parenR", () => {
			const value: any = $.CONSUME(t.PAREN_R)
			return $.ACTION(() => handle.delimiter.parenR(...processToken(value, $.shift)))
		})
		$.RULE("bracketL", () => {
			const value = $.CONSUME(t.BRACKET_L)

			return $.ACTION(() => {
				// magic, see parse
				const loc = extractPosition(value, $.shift)
				return $.shift === 0 || loc.start > 0
					? handle.delimiter.bracketL(value.isInsertedInRecovery ? undefined : value.image, loc)
					: undefined
			})
		})
		$.RULE("bracketR", () => {
			const value: any = $.CONSUME(t.BRACKET_R)
			return $.ACTION(() => handle.delimiter.bracketR(...processToken(value, $.shift)))
		})
		this.performSelfAnalysis()
	}
}
export interface ParserBase {
	shift: number
	main: () => ParserResults
	anySym: () => IToken
	boolOr: () => ExpressionNode
	boolAnd: () => ExpressionNode
	condition: () => ConditionNode | GroupNode
	// the arguments to add a property to a condition node
	property: () => {
		prop?: VariableNode
		rest: {
			sepL?: ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP>
			sepR?: ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP>
			propertyOperator?: ConditionNode["propertyOperator"]
		}
	}
	// not an actual group node but the arguments to create one
	plainGroup: () => [ValidToken<TOKEN_TYPE.PARENL>, GroupNode["expression"], ValidToken<TOKEN_TYPE.PARENR> | undefined]
	plainBracketGroup: () => ArrayNode
	not: () => ValidToken<TOKEN_TYPE.NOT> // is always valid since it's optional
	variable: () => VariableNode
	valueDelimAny: () => AnyToken<TokenQuoteTypes>
	quoteSingle: () => AnyToken<TOKEN_TYPE.SINGLEQUOTE>
	quoteDouble: () => AnyToken<TOKEN_TYPE.DOUBLEQUOTE>
	quoteBacktick: () => AnyToken<TOKEN_TYPE.BACKTICK>
	regexAny: () => AnyToken<TOKEN_TYPE.REGEX> | [AnyToken<TOKEN_TYPE.REGEX>, ValidToken<TOKEN_TYPE.VALUE>]
	valueNotSingle: () => AnyToken<TOKEN_TYPE.VALUE>
	valueNotDouble: () => AnyToken<TOKEN_TYPE.VALUE>
	valueNotBacktick: () => AnyToken<TOKEN_TYPE.VALUE>
	valueUnquoted: () => AnyToken<TOKEN_TYPE.VALUE>
	valueRegex: () => AnyToken<TOKEN_TYPE.VALUE>
	parenL: () => ValidToken<TOKEN_TYPE.PARENL> // always valid, see getUnclosedRightParenCount for magic
	parenR: () => ValidToken<TOKEN_TYPE.PARENR> | undefined
	bracketL: () => ValidToken<TOKEN_TYPE.BRACKETL> // always valid, see getUnclosedRightParenCount for magic
	bracketR: () => ValidToken<TOKEN_TYPE.BRACKETR> | undefined
}
