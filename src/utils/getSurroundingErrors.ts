/**
 * Mostly for internal use by {@link autosuggest}.
 *
 * Returns all error tokens immediately before/after cursor (since there might be multiple error tokens one after the other).
 *
 * The errors are sorted by closeness to the given cursor (inside {@link CursorInfo}), with quote errors having priority, then paren errors, then any other errors. They can be sorted by closeness because although two errors might follow each other, their positions might be different because of whitespace, but they can still be fixed from any cursor position between their ends.
 *
 * For example:
 * ```
 * a a"
 *  ^ operator missing at 1
 *   ^ doublequote missing at 2
 * if the cursor is at 1 (`a| a"`):
 * errors = [operator, doublequote]
 * if the cursor is at 2 (`a |a"`):
 * errors = [doublequote, operator]
 *
 * either insertion would fix the issue for either position would fix the issue, albeit with different results
 * ```
 */

import { type AnyToken,type ErrorToken,TOKEN_TYPE } from "../types/ast.js"
import type { CursorInfo } from "../types/autocomplete.js"


export function getSurroundingErrors(tokens: AnyToken[], token: CursorInfo): ErrorToken[] {
	if (token.at) {return []}
	const i = tokens.indexOf(token.next ?? token.prev as any)

	let iNext: number = tokens[i] === token.next ? i : i + 1
	let iPrev: number = tokens[i] === token.next ? i - 1 : i

	const errors: ErrorToken[] = []
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
	while (tokens[iNext]?.valid === false) {
		errors.push(tokens[iNext] as ErrorToken)
		iNext++
	}
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
	while (tokens[iPrev]?.valid === false) {
		errors.push(tokens[iPrev] as ErrorToken)
		iPrev--
	}

	return errors.sort((a, b) => {
		const aIsQuote = ([TOKEN_TYPE.DOUBLEQUOTE, TOKEN_TYPE.BACKTICK, TOKEN_TYPE.SINGLEQUOTE] as string[]).includes(a.expected[0])
		const bIsQuote = ([TOKEN_TYPE.DOUBLEQUOTE, TOKEN_TYPE.BACKTICK, TOKEN_TYPE.SINGLEQUOTE]as string[]).includes(b.expected[0])
		const aIsParen = ([TOKEN_TYPE.PARENR, TOKEN_TYPE.PARENL] as string[]).includes(a.expected[0])
		const bIsParen = ([TOKEN_TYPE.PARENR, TOKEN_TYPE.PARENL] as string[]).includes(b.expected[0])
		const aCloseness = Math.abs(i - tokens.indexOf(a))
		const bCloseness = Math.abs(i - tokens.indexOf(b))
		const closenessComparison = aCloseness - bCloseness
		if (aIsQuote === bIsQuote) {
			if (aIsParen !== bIsParen) {return aIsParen ? -1 : 1}
		}
		return closenessComparison
	}) as ErrorToken[]
}
