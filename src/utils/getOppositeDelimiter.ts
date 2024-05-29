import { unreachable } from "@alanscodelog/utils/unreachable.js"

import { isBracket } from "./isBracket.js"
import { isDelimiter } from "./isDelimiter.js"
import { isParen } from "./isParen.js"
import { isQuote } from "./isQuote.js"

import type { ArrayNode } from "../ast/classes/ArrayNode.js"
import type { ConditionNode } from "../ast/classes/ConditionNode.js"
import type { GroupNode } from "../ast/classes/GroupNode.js"
import type { VariableNode } from "../ast/classes/VariableNode.js"
import { type AnyToken, TOKEN_TYPE, type TokenDelimiterTypes } from "../types/ast.js"

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
