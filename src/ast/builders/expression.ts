import { pos } from "./pos"
import { token } from "./token"

import { ConditionNode, ErrorToken, ExpressionNode, GroupNode } from "@/ast/classes"
import { AnyToken, AST_TYPE, EmptyObj, Position, TOKEN_TYPE, TokenBooleanTypes } from "@/types"


/**
 * Creates an @see ExpressionNode, can be passed nothing for any of the tokens to automatically create error tokens.
 *
 * Also automatically sets the correct start/end positions from valid tokens (e.g. for start, searching left to right for a valid token and vice versa) assuming at least one is defined.
 */

export function expression(
	left:
	ConditionNode |
	ExpressionNode |
	GroupNode |
	ErrorToken<TOKEN_TYPE.VALUE> |
	undefined,
	operator:
	AnyToken<TokenBooleanTypes> |
	undefined,
	right:
	ConditionNode |
	ExpressionNode |
	GroupNode |
	ErrorToken<TOKEN_TYPE.VALUE> |
	undefined
): ExpressionNode {
	const start =
		left?.start ??
		operator?.start ??
		right?.start
	const end =
		right?.end ??
		operator?.end ??
		left?.end


	const position = pos({ start, end } as Position | EmptyObj)

	if (left === undefined) {
		left = token(TOKEN_TYPE.VALUE, undefined, { start: position.start })
	}
	let op!: ExpressionNode["operator"]
	if (operator === undefined) {
		operator = token([TOKEN_TYPE.AND, TOKEN_TYPE.OR], undefined, { start: left.end })
	} else op = operator

	if (right === undefined) {
		right = token(TOKEN_TYPE.VALUE, undefined, { start: op.end })
	}

	const node: Partial<ExpressionNode> = {
		type: AST_TYPE.EXPRESSION,
		left,
		operator: op,
		right,
		...position,
	}

	const instance = new ExpressionNode(node as any)
	return instance
}
