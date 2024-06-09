import { type AddParameters } from "@alanscodelog/utils/types"

import { isNode } from "./isNode.js"

import { type AnyToken, AST_TYPE, type Nodes, } from "../types/ast.js"

/**
 * Creates a map like Map<Node, Parent>, for easily accessing parents of nodes.
 *
 * This is done like this to avoid having circular structures in the ast.
 *
 * To get a properly typed parent, use {@link getParent} which you will need to pass a generated map.
 */
export function generateParentsMap(ast: Nodes | AnyToken): Map<Nodes | AnyToken, Nodes> {
	// eslint-disable-next-line prefer-rest-params
	const recursiveMap = arguments[1] as Map<any, any>
	const map = recursiveMap ?? new Map<any, any>()
	const self: AddParameters<typeof generateParentsMap, [Map<any, any>]> = generateParentsMap
	if (ast.type === AST_TYPE.VARIABLE) {
		if (ast.prefix) map.set(ast.prefix, ast)
		if (ast.quote?.left) map.set(ast.quote.left, ast)
		if (ast.quote?.right) map.set(ast.quote.right, ast)
		if (ast.quote?.flags) map.set(ast.quote.flags, ast)
		map.set(ast.value, ast)
	} else if (ast.type === AST_TYPE.CONDITION) {
		if (ast.operator) map.set(ast.operator, ast)
		if (ast.property) {
			map.set(ast.property, ast)
			if (isNode(ast.property)) self(ast.property, map)
		}
		if (ast.propertyOperator) map.set(ast.propertyOperator, ast)
		if (ast.sep?.left) map.set(ast.sep.left, ast)
		if (ast.sep?.right) map.set(ast.sep.right, ast)
		map.set(ast.value, ast)
		if (isNode(ast.value)) self(ast.value, map)
	} else if (ast.type === AST_TYPE.EXPRESSION) {
		if (ast.operator) map.set(ast.operator, ast)
		map.set(ast.right, ast)
		if (isNode(ast.right)) self(ast.right, map)
		map.set(ast.left, ast)
		if (isNode(ast.left)) self(ast.left, map)
	} else if (ast.type === AST_TYPE.GROUP) {
		if (ast.prefix) {
			map.set(ast.prefix, ast)
			if (isNode(ast.prefix)) self(ast.prefix, map)
		}
		if (ast.paren?.left) map.set(ast.paren.left, ast)
		if (ast.paren?.right) map.set(ast.paren.right, ast)
		map.set(ast.expression, ast)
		if (isNode(ast.expression)) self(ast.expression, map)
	} else if (ast.type === AST_TYPE.ARRAY) {
		if (ast.bracket.left) map.set(ast.bracket.left, ast)
		if (ast.bracket.right) map.set(ast.bracket.right, ast)
		for (const val of ast.values) {
			map.set(val, ast)
			if (isNode(val)) self(val, map)
		}
	}
	return map as any
}
