import { token } from "./token.js"

import { type ConditionNode, type ErrorToken, type ExpressionNode, type FirstParam,type GroupNode, type Position, TOKEN_TYPE, type ValidToken } from "../../types/ast.js"
import { createGroupNode } from "../createGroupNode.js"

/**
 * Creates a group.
 *
 * Automatically creates error tokens if missing condition or parens (not prefix because it is optional). Will look at the position of prefix if available.
 *
 * @param paren Use to add parens to group, usually by using {@link delim} . If either `right` or `left` are false or undefined, error tokens will be created. Unlike {@link variable}, if undefined is passed for parens, parens are created by default.
 *
 * The positions of the parens can be adjusted with the last two parameters by passing positions.
 */

export function group(
	prefix:
	| ConditionNode
	| ValidToken<typeof TOKEN_TYPE.NOT>
	| undefined,

	expression:
	| ConditionNode
	| ExpressionNode
	| GroupNode
	| ErrorToken
	| undefined,

	paren: { left?: boolean, right?: boolean } = { right: true, left: true },
	parenLeftPos?: Position,
	parenRightPos?: Position,
): GroupNode {
	expression ??= token(TOKEN_TYPE.VALUE, undefined, prefix?.end !== undefined ? { start: prefix.end } : undefined)

	const node: Partial<FirstParam<typeof createGroupNode>> = {
		prefix: undefined,
		expression,
	}
	if (prefix) {
		node.prefix = prefix
		const locToRight = node.paren?.left?.start ?? node.expression?.start ?? node.paren?.right.start
		if (prefix.start === undefined && locToRight !== undefined) {
			throw new Error("group builder: missing prefix location when passed expression with location")
		}
	}

	node.paren = {} as any

	const start = expression.start
	const end = expression.end

	parenLeftPos ??= (start !== undefined ? { start: start - 1, end: start } : undefined)
	parenRightPos ??= (end !== undefined ? { start: end, end: end + 1 } : undefined)

	if (paren?.left) {
		node.paren!.left = token(TOKEN_TYPE.PARENL, "(", parenLeftPos)
	} else {
		if (parenLeftPos) {parenLeftPos.start = parenLeftPos.end}
		node.paren!.left = token(TOKEN_TYPE.PARENL, undefined, parenLeftPos)
	}

	if (paren?.right) {
		node.paren!.right = token(TOKEN_TYPE.PARENR, ")", parenRightPos)
	} else {
		if (parenRightPos) {parenRightPos.end = parenRightPos.start}
		node.paren!.right = token(TOKEN_TYPE.PARENR, undefined, parenRightPos)
	}

	node.start = node.prefix?.start ?? node.paren?.left?.start ?? node.expression?.start ?? node.paren?.right.start
	node.end = node.paren?.right?.end ?? node.expression?.end ?? node.paren?.left.end ?? node.prefix?.end

	return createGroupNode(node as any)
}
