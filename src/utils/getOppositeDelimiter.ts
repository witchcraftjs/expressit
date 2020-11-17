import { unreachable } from "@utils/utils"

import { isBracket } from "./isBracket"
import { isDelimiter } from "./isDelimiter"
import { isParen } from "./isParen"
import { isQuote } from "./isQuote"

import type { ArrayNode, ConditionNode, GroupNode, VariableNode } from "@/ast/classes"
import { AnyToken, TOKEN_TYPE, TokenDelimiterTypes } from "@/types"


/**
 * Given a delimiter token, returns it's opposite pair, or undefined if the type passed was not a delimiter token (so you can pass any type without checking).
 */
export function getOppositeDelimiter(token: AnyToken): AnyToken<TokenDelimiterTypes> | undefined {
	if (!isDelimiter(token)) throw new Error("Token is not a delimiter type.")
	if (isParen(token)) {
		const paren = (token.parent as GroupNode).paren
		const opposite = paren.left === token ? "right" : "left"
		return paren[opposite]
	} else if (isBracket(token)) {
		const bracket = (token.parent as ArrayNode).bracket
		const opposite = bracket.left === token ? "right" : "left"
		return bracket[opposite]
	} else if (isQuote(token)) {
		const quotes = (token.parent as VariableNode).quote
		if (quotes === undefined) unreachable()
		const opposite = quotes.left === token ? "right" : "left"
		return quotes[opposite]
	} else if (token.type === TOKEN_TYPE.OP_EXPANDED_SEP) {
		const sep = (token.parent as ConditionNode).sep
		if (sep === undefined) unreachable()
		const opposite = sep.left === token ? "right" : "left"
		return sep[opposite]
	}
	unreachable()
}
