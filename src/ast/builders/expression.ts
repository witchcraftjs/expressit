import { pos } from "./pos.js"
import { token } from "./token.js"

import { type AnyToken, type ConditionNode, type ErrorToken, type ExpressionNode,type GroupNode, type Position, TOKEN_TYPE, type TokenBoolean } from "../../types/ast.js"
import { createExpressionNode } from "../createExpressionNode.js"


/**
 * Creates an {@link ExpressionNode}, can be passed nothing for any of the tokens to automatically create error tokens.
 *
 * Also automatically sets the correct start/end positions from valid tokens (e.g. for start, searching left to right for a valid token and vice versa) assuming at least one is defined.
 */
export function expression(
	left:
		ConditionNode |
		ExpressionNode |
		GroupNode |
		ErrorToken |
		undefined,
	operator:
		AnyToken<TokenBoolean> |
		undefined,
	right:
		ConditionNode |
		ExpressionNode |
		GroupNode |
		ErrorToken |
		undefined,
): ExpressionNode {
	const start =
		left?.start ??
		operator?.start ??
		right?.start
	const end =
		right?.end ??
		operator?.end ??
		left?.end


	const position = pos({ start, end } as Position)

	left ??= token(TOKEN_TYPE.VALUE, undefined, { start: position.start })
	let op!: ExpressionNode["operator"]
	if (operator === undefined) {
		operator = token([TOKEN_TYPE.AND, TOKEN_TYPE.OR], undefined, { start: left.end })
	} else op = operator

	right ??= token(TOKEN_TYPE.VALUE, undefined, { start: op.end })

	return createExpressionNode({
		left,
		operator: op,
		right,
		...position,
	})
}
