import { unreachable } from "@utils/utils"

import { ArrayNode, ConditionNode, ErrorToken, ExpressionNode, GroupNode, Node, VariableNode } from "@/ast/classes"
import type { AnyToken, AST_TYPE } from "@/types"


/**
 * Extract a list of all the tokens (which might or might not be valid).
 */
export function extractTokens(ast: Node<AST_TYPE> | ErrorToken): AnyToken[] {
	if (ast instanceof ErrorToken) {
		return [ast]
	}
	if (ast instanceof VariableNode) {
		const prefix = ast.prefix ? [ast.prefix] : []
		const quoteR = ast.quote ? [ast.quote.right] : []
		const quoteL = ast.quote ? [ast.quote.left] : []
		const quoteFlags = ast.quote?.flags ? [ast.quote.flags] : []
		return [...prefix, ...quoteL, ast.value, ...quoteR, ...quoteFlags]
	}
	if (ast instanceof ConditionNode) {
		const value = ast.value instanceof Node
			? extractTokens(ast.value)
			: [ast.value]
		const operator = ast.operator ? [ast.operator] : []
		const property = ast.property ? extractTokens(ast.property) : []
		const propertyOperator = ast.propertyOperator ? [ast.propertyOperator] : []
		const sepL = ast.sep?.left ? [ast.sep.left] : []
		const sepR = ast.sep?.right ? [ast.sep.right] : []
		return [...operator, ...property, ...sepL, ...propertyOperator, ...sepR, ...value]
	}
	if (ast instanceof GroupNode) {
		const prefix = ast.prefix ?
			ast.prefix instanceof Node
				? extractTokens(ast.prefix)
				: [ast.prefix]
			: []
		const parenL = ast.paren ? [ast.paren.left] : []
		const parenR = ast.paren ? [ast.paren.right] : []
		const expression = ast.expression instanceof Node
				? extractTokens(ast.expression)
				: [ast.expression]
		return [...prefix, ...parenL, ...expression, ...parenR]
	}
	if (ast instanceof ArrayNode) {
		const values = ast.values.map(val => extractTokens(val))
		return [ast.bracket.left, ...values.flat(), ast.bracket.right]
	}

	if (ast instanceof ExpressionNode) {
		const right = ast.right instanceof Node
			? extractTokens(ast.right)
			: [ast.right] as AnyToken[]

		const left = ast.left instanceof Node
			? extractTokens(ast.left)
			: [ast.left] as AnyToken[]
		return [...left, ast.operator, ...right]
	}
	return unreachable()
}
