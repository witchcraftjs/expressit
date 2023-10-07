import { insert } from "@alanscodelog/utils"

import type { Completion } from "../types/autocomplete.js"


export class AutoreplaceMixin {
	/**
	 * Given the input string and a @see Completion consisting of the value of the replacement and a @see Suggestion entry, returns the replacement string and the new position of the cursor.
	 *
	 * The value passed should be escaped if it's needed (or quoted). @see autocomplete already takes care of quoting variables if you're using it.
	 */
	autoreplace(
		input: string,
		{ value, suggestion }: Completion
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
}
