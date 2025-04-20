import { unreachable } from "@alanscodelog/utils/unreachable.js"

import type { generateParentsMap } from "./generateParentsMap.js"
import { isBracket } from "./isBracket.js"
import { isDelimiter } from "./isDelimiter.js"
import { isParen } from "./isParen.js"
import { isQuote } from "./isQuote.js"

import { type AnyToken, type ArrayNode, type ConditionNode,type GroupNode, TOKEN_TYPE, type TokenDelimiter, type VariableNode } from "../types/ast.js"

/**
 * Given a delimiter token, returns it's opposite pair, or undefined if the type passed was not a delimiter token (so you can pass any type without checking).
 */
export function getOppositeDelimiter(
	token: AnyToken,
	parentsMap: ReturnType<typeof generateParentsMap>
): AnyToken<TokenDelimiter> | undefined {
	const parent = parentsMap.get(token)
	if (!isDelimiter(token)) throw new Error("Token is not a delimiter type.")
	if (isParen(token)) {
		const paren = (parent as GroupNode).paren
		const opposite = paren.left === token ? "right" : "left"
		return paren[opposite]
	} else if (isBracket(token)) {
		const bracket = (parent as ArrayNode).bracket
		const opposite = bracket.left === token ? "right" : "left"
		return bracket[opposite]
	} else if (isQuote(token)) {
		const quotes = (parent as VariableNode).quote
		if (quotes === undefined) unreachable()
		const opposite = quotes.left === token ? "right" : "left"
		return quotes[opposite]
	} else if (token.type === TOKEN_TYPE.OP_EXPANDED_SEP) {
		const sep = (parent as ConditionNode).sep
		if (sep === undefined) unreachable()
		const opposite = sep.left === token ? "right" : "left"
		return sep[opposite]
	}
	unreachable()
}
