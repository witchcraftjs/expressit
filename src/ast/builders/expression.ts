import { pos } from "./pos.js"
import { token } from "./token.js"

import { type AnyToken, type Position, TOKEN_TYPE, type TokenBooleanTypes } from "../../types/ast.js"
import type { ConditionNode } from "../classes/ConditionNode.js"
import type { ErrorToken } from "../classes/ErrorToken.js"
import { ExpressionNode } from "../classes/ExpressionNode.js"
import type { GroupNode } from "../classes/GroupNode.js"


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

	const node: ConstructorParameters<typeof ExpressionNode>[0] = {
		left,
		operator: op,
		right,
		...position,
	}

	const instance = new ExpressionNode(node)
	return instance
}
