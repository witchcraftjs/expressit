import { unreachable } from "@alanscodelog/utils/unreachable"

import { isNode } from "./isNode.js"
import { isToken } from "./isToken.js"

import { type AnyToken, AST_TYPE, type ErrorToken, type Nodes } from "../types/ast.js"


/**
 * Extract a list of all the tokens (which might or might not be valid).
 */
export function extractTokens(ast: ErrorToken | Nodes): AnyToken[] {
	if (isToken(ast) && !ast.valid) {
		return [ast]
	}
	if (ast.type === AST_TYPE.VARIABLE) {
		const prefix = ast.prefix ? [ast.prefix] : []
		const quoteR = ast.quote ? [ast.quote.right] : []
		const quoteL = ast.quote ? [ast.quote.left] : []
		const quoteFlags = ast.quote?.flags ? [ast.quote.flags] : []
		return [...prefix, ...quoteL, ast.value, ...quoteR, ...quoteFlags]
	}
	if (ast.type === AST_TYPE.CONDITION) {
		const value = isNode(ast.value)
			? extractTokens(ast.value)
			: [ast.value]
		const operator = ast.operator ? [ast.operator] : []
		const property = ast.property ? extractTokens(ast.property) : []
		const propertyOperator = ast.propertyOperator ? [ast.propertyOperator] : []
		const sepL = ast.sep?.left ? [ast.sep.left] : []
		const sepR = ast.sep?.right ? [ast.sep.right] : []
		return [...operator, ...property, ...sepL, ...propertyOperator, ...sepR, ...value]
	}
	if (ast.type === AST_TYPE.GROUP) {
		const prefix = ast.prefix ?
			isNode(ast.prefix)
				? extractTokens(ast.prefix)
				: [ast.prefix]
			: []
		const parenL = ast.paren ? [ast.paren.left] : []
		const parenR = ast.paren ? [ast.paren.right] : []
		const expression = isNode(ast.expression)
				? extractTokens(ast.expression)
				: [ast.expression]
		return [...prefix, ...parenL, ...expression, ...parenR]
	}
	if (ast.type === AST_TYPE.ARRAY) {
		const values = ast.values.map(val => extractTokens(val))
		return [ast.bracket.left, ...values.flat(), ast.bracket.right]
	}

	if (ast.type === AST_TYPE.EXPRESSION) {
		const right = isNode(ast.right)
			? extractTokens(ast.right)
			: [ast.right] as AnyToken[]

		const left = isNode(ast.left)
			? extractTokens(ast.left)
			: [ast.left] as AnyToken[]
		return [...left, ast.operator, ...right]
	}
	return unreachable()
}
