import { unreachable } from "@alanscodelog/utils"

import { ConditionNode } from "../ast/classes/ConditionNode.js"
import { VariableNode } from "../ast/classes/VariableNode.js"
import type { Parser } from "../parser.js"
import { type Completion, type Suggestion, SUGGESTION_TYPE } from "../types/autocomplete.js"
import type { FullParserOptions } from "../types/parser.js"


export class AutocompleteMixin<T extends {}> {
	/**
	 * Given a list of @see Suggestion entries, the parser options, and a list of variables, prefixes, operators, etc, and the preferred quote type, returns a list of @see Completion entries.
	 *
	 * It takes care of suggesting the correct delimiters for fixes, quoting variables/prefixes if it would not be possible to parse them unquoted, and separating symbol from non-symbol (word) operators.
	 *
	 * Does not add whitespace or group requirements. The suggestion information is still in the completion if you wish to show these. But they should not be added to the completion value if using @see autoreplace which will take care of it.
	 *
	 * Is not aware of existing values. You will have to use @see getCursorInfo to understand the context in which the suggestion was made, so that, for example, you could filter out used regex flags.
	 */
	autocomplete(
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
		} = {}
	): Completion[] {
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
							const flags = token.at && (token.at.parent as VariableNode)?.quote?.flags === suggestion.cursorInfo.at
								? token.at
								: token.next && (token.next.parent as VariableNode)?.quote?.flags === suggestion.cursorInfo.next
									? token.next
									: token.prev && (token.prev.parent as VariableNode)?.quote?.flags === suggestion.cursorInfo.prev
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
					return arr.map(variable => {
						// we don't need to alter options since we can just check there are no quotes (also tells us no prefixes are used) and no operators are defined
						const res = self.parse(variable)
						if (res instanceof ConditionNode &&
							res.operator === undefined &&
							res.value instanceof VariableNode &&
							res.value.quote === undefined) {
							return { suggestion, value: res.value.value.value }
						} else {
							return { suggestion, value: quote + variable.replace(new RegExp(quote, "g"), `\\${quote}`) + quote }
						}
					})
				}
				case SUGGESTION_TYPE.PREFIX: return prefixes.map(prefix => {
					const res = self.parse(prefix)
					if (res instanceof ConditionNode &&
						res.operator === undefined &&
						res.value instanceof VariableNode &&
						res.value.quote === undefined) {
						return { suggestion, value: res.value.value.value }
					} else {
						return { suggestion, value: quote + prefix.replace(new RegExp(quote, "g"), `\\${quote}`) + quote }
					}
				})
			}
		}).flat()
	}
}
