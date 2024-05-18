import { unreachable } from "@alanscodelog/utils/unreachable"
import type { DeepPartial } from "@alanscodelog/utils/types"

import { pos } from "../ast/builders/pos.js"
import { ArrayNode } from "../ast/classes/ArrayNode.js"
import { ConditionNode } from "../ast/classes/ConditionNode.js"
import { ErrorToken } from "../ast/classes/ErrorToken.js"
import { GroupNode } from "../ast/classes/GroupNode.js"
import type { ValidToken } from "../ast/classes/ValidToken.js"
import { VariableNode } from "../ast/classes/VariableNode.js"
import type { Parser } from "../parser.js"
import { type ParserResults, TOKEN_TYPE } from "../types/ast.js"
import { type Suggestion, SUGGESTION_TYPE } from "../types/autocomplete.js"
import type { KeywordEntry } from "../types/parser.js"
import { extractTokens } from "../utils/extractTokens.js"
import { getCursorInfo } from "../utils/getCursorInfo.js"
import { getSurroundingErrors } from "../utils/getSurroundingErrors.js"


const defaultNodeDirs = {
	before: false,
	after: false,
}

const createDefaultRequires = (partial: DeepPartial<Suggestion["requires"]> = {}): Suggestion["requires"] => ({
	whitespace: {
		...defaultNodeDirs,
		...(partial.whitespace ? partial.whitespace : {}),
	},
	group: partial.group ?? false,
	prefix: partial.prefix ?? false,
})

/** Returns if valid token requires whitespace if none between cursor and token. */
const tokenRequiresWhitespace = (validToken: ValidToken | undefined, whitespace: boolean, wordOps: KeywordEntry[]): boolean => {
	if (whitespace || validToken === undefined) return false
	return validToken.type === TOKEN_TYPE.VALUE ||
		([TOKEN_TYPE.AND, TOKEN_TYPE.OR, TOKEN_TYPE.NOT].includes(validToken.type) &&
			wordOps.find(_ => _.value === validToken.value) !== undefined)
}
const tokenVariable = [TOKEN_TYPE.BACKTICK, TOKEN_TYPE.DOUBLEQUOTE, TOKEN_TYPE.SINGLEQUOTE, TOKEN_TYPE.VALUE, TOKEN_TYPE.REGEX]


export class Autosuggest<T extends {}> {
	/**
	 * Returns a list of suggestions ( @see Suggestion ). These are not a list of autocomplete entries (with values), but more a list of entries describing possible suggestions. This list can then be passed to @see Parser["autocomplete"] to build a list to show users, from which you can then pick an entry to pass to @see Parser["autoreplace"] .
	 *
	 * The list returned is "unsorted", but there is still some logic to the order. Fixes for errors are suggested first, in the order returned by @see getSurroundingErrors. Regular suggestions come after in the following order: prefixes if enabled, variables, boolean symbol operators, then boolean word operators.
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
		// wrapped like this because the function is HUGE
		const opts = (this as any as Parser<T>).options
		const tokens = extractTokens(ast)
		const token = getCursorInfo(input, tokens, index)

		const wordOps = [...opts.keywords.and, ...opts.keywords.or, ...opts.keywords.not].filter(op => !op.isSymbol)

		const canSuggestOpAfterPrev = (
			token.valid.prev && tokenVariable.includes(token.valid.prev?.type) &&
			(token.whitespace.prev || token.valid.prev.type === TOKEN_TYPE.PARENR) &&
			!token.at && token.valid.next === undefined
		)
		const canSuggestOpBeforeNext =
			(
				token.valid.next && tokenVariable.includes(token.valid.next?.type) &&
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
		if (ast instanceof ErrorToken) {
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

			const errorTypesHandled: TOKEN_TYPE[] = []
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
							const isLeft = (error.parent as VariableNode).quote!.left === error
							const isRight = (error.parent as VariableNode).quote!.right === error
							suggestions.push({
								...errorSuggestion,
								type: type as any as SUGGESTION_TYPE,
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
								type: type as any as SUGGESTION_TYPE,
								requires: createDefaultRequires(),
								range: pos({ start: index }, { fill: true }),
							})
							break
						case TOKEN_TYPE.VALUE: {
							const prefixedValue = error.parent instanceof VariableNode ? error.parent?.prefix?.value : false
							const isRegexValue = error.parent instanceof VariableNode && (
								error.parent.quote?.left.type === TOKEN_TYPE.REGEX ||
								error.parent.quote?.right.type === TOKEN_TYPE.REGEX
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
			const prevVar = token.valid.prev?.parent
			const nextVar = token.valid.next?.parent
			const prevCondition = prevVar?.parent
			const nextCondition = nextVar?.parent
			const atVar = token.at?.parent
			const atCondition = atVar?.parent

			const isVarPrev =
				!token.whitespace.prev &&
				token.valid.prev?.type !== TOKEN_TYPE.REGEX &&
				prevVar instanceof VariableNode &&
				(
					(
						prevCondition instanceof ConditionNode &&
						prevCondition.value === prevVar &&
						(
							prevVar.quote?.right === token.valid.prev ||
							prevVar.value === token.valid.prev
						)
					) ||
					(
						prevCondition instanceof ArrayNode
					)
				)

			const isVarNext =
				!token.whitespace.next &&
				token.valid.next?.type !== TOKEN_TYPE.REGEX &&
				nextVar instanceof VariableNode &&
				(
					(
						nextCondition instanceof ConditionNode &&
						nextCondition.value === nextVar &&
						(
							nextVar.quote?.left === token.valid.next ||
							nextVar.value === token.valid.next
						)
					) ||
					(
						nextCondition instanceof ArrayNode
					)
				)

			const isVarAt = (
				(
					atVar instanceof VariableNode &&
					atCondition instanceof ConditionNode
				) ||
				(
					prevVar instanceof VariableNode &&
					token.valid.prev === prevVar?.quote?.left) ||

				(
					nextVar instanceof VariableNode &&
					token.valid.next === nextVar?.quote?.right
				)
			)

			const isPropertyPrev =
				prevCondition instanceof ConditionNode &&
				prevVar !== undefined &&
				prevVar === prevCondition?.property
			const isPropertyNext =
				nextCondition instanceof ConditionNode &&
				nextVar !== undefined &&
				nextVar === nextCondition?.property
			const isPropertyAt =
				atCondition instanceof ConditionNode &&
				atVar !== undefined &&
				atVar === atCondition?.property

			const isPropertyOperatorPrev = prevVar instanceof ConditionNode && token.valid.prev === prevVar?.propertyOperator
			const isPropertyOperatorNext = nextVar instanceof ConditionNode && token.valid.next === nextVar?.propertyOperator
			const isPropertyOperatorAt = atVar instanceof ConditionNode && token.at === atVar?.propertyOperator

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
				const parent = target.parent
				if (parent instanceof VariableNode) {
					const range = pos(parent)
					const condition = parent?.parent as ConditionNode
					const isValue = condition.propertyOperator !== undefined && condition.value === parent
					const maybeGroup = parent?.parent?.parent
					const isPrefix = maybeGroup instanceof GroupNode && maybeGroup.prefix === condition

					// look at whitespace before/after the entire variable
					const varStart = getCursorInfo(input, ast, parent.start)
					const varEnd = getCursorInfo(input, ast, parent.end)
					const targetRequiresWhitespacePrev = tokenRequiresWhitespace(varStart.valid.prev, varStart.whitespace.prev, wordOps)
					const targetRequiresWhitespaceNext = tokenRequiresWhitespace(varEnd.valid.next, varEnd.whitespace.next, wordOps)
					const prefixedValue = target.parent instanceof VariableNode ? target.parent?.prefix?.value : false

					// most of these require additional handling below
					const isSepPrev = token.prev?.type === TOKEN_TYPE.OP_EXPANDED_SEP
					const arrayValue = target.parent?.parent instanceof ArrayNode
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
				suggestions.push({
					...baseSuggestion,
					type: (propOpTarget.parent as ConditionNode).sep
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
				const inArrayNode = [nextCondition, prevCondition, nextVar, prevVar].find(_ => _ instanceof ArrayNode) !== undefined
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

			const canSuggestRegexFlags =
				// has existing flags before/after
				(
					token.at &&
					token.at === (token.at?.parent as VariableNode)?.quote?.flags
				) ||
				(
					token.valid.prev &&
					token.valid.prev === (token.valid.prev?.parent as VariableNode)?.quote?.flags
				) ||
				(
					token.valid.next &&
					token.valid.next === (token.valid.next?.parent as VariableNode)?.quote?.flags
				) ||
				( // no flags
					token.valid.prev?.type === TOKEN_TYPE.REGEX &&
					token.valid.prev === (token.valid.prev.parent as VariableNode).quote?.right
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
}
