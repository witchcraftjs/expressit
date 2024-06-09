import { AST_TYPE, type ExpressionNode,type RawNode } from "../types/ast.js"
import { isNode } from "../utils/isNode.js"


export function createExpressionNode<TValid extends boolean = boolean>(
	raw: RawNode< ExpressionNode<TValid>>
): ExpressionNode<TValid> {
	const valid = (
		raw.operator.valid &&
		isNode(raw.left) &&
		raw.left.valid &&
		isNode(raw.right) &&
		raw.right.valid
	)
	return {
		...raw,
		isNode: true,
		valid,
		type: AST_TYPE.EXPRESSION,
	}
}
