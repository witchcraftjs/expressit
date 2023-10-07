import { ArrayNode } from "../../ast/classes/ArrayNode.js"
import { ConditionNode } from "../../ast/classes/ConditionNode.js"
import { ExpressionNode } from "../../ast/classes/ExpressionNode.js"
import { GroupNode } from "../../ast/classes/GroupNode.js"
import { Node } from "../../ast/classes/Node.js"
import { VariableNode } from "../../ast/classes/VariableNode.js"
import type { Nodes } from "../../types/ast.js"

/** @internal */
export function assignParents(ast: Nodes): void {
	if (ast instanceof VariableNode) {
		if (ast.prefix) ast.prefix.parent = ast
		if (ast.quote?.left) ast.quote.left.parent = ast
		if (ast.quote?.right) ast.quote.right.parent = ast
		if (ast.quote?.flags) ast.quote.flags.parent = ast
		ast.value.parent = ast
	} else if (ast instanceof ConditionNode) {
		if (ast.operator) ast.operator.parent = ast
		if (ast.property) {
			ast.property.parent = ast
			if (ast.property instanceof Node) assignParents(ast.property)
		}
		if (ast.propertyOperator) ast.propertyOperator.parent = ast
		if (ast.sep?.left) ast.sep.left.parent = ast
		if (ast.sep?.right) ast.sep.right.parent = ast
		ast.value.parent = ast
		if (ast.value instanceof Node) assignParents(ast.value)
	} else if (ast instanceof ExpressionNode) {
		if (ast.operator) ast.operator.parent = ast
		ast.right.parent = ast
		if (ast.right instanceof Node) assignParents(ast.right)
		ast.left.parent = ast
		if (ast.left instanceof Node) assignParents(ast.left)
	} else if (ast instanceof GroupNode) {
		if (ast.prefix) {
			ast.prefix.parent = ast
			if (ast.prefix instanceof Node) assignParents(ast.prefix)
		}
		if (ast.paren?.left) ast.paren.left.parent = ast
		if (ast.paren?.right) ast.paren.right.parent = ast
		ast.expression.parent = ast
		if (ast.expression instanceof Node) assignParents(ast.expression)
	} else if (ast instanceof ArrayNode) {
		if (ast.bracket.left) ast.bracket.left.parent = ast
		if (ast.bracket.right) ast.bracket.right.parent = ast
		for (const val of ast.values) {
			val.parent = ast
			assignParents(val)
		}
	}
}
