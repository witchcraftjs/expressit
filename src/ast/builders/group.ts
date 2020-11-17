import type { Mutable } from "@utils/types"

import { token } from "./token"

import { ConditionNode, ErrorToken, ExpressionNode, GroupNode, ValidToken } from "@/ast/classes"
import { AST_TYPE, Position, TOKEN_TYPE } from "@/types"


/**
 * Creates a group.
 *
 * Automatically creates error tokens if missing condition or parens (not prefix because it is optional). Will look at the position of prefix if available.
 *
 * @param paren Use to add parens to group, usually by using @see delim . If either `right` or `left` are false or undefined, error tokens will be created. Unlike @see variable, if undefined is passed for parens, parens are created by default.
 *
 * The positions of the parens can be adjusted with the last two parameters by passing positions.
 */

export function group(
	prefix:
	| ConditionNode
	| ValidToken<TOKEN_TYPE.NOT>
	| undefined,

	expression:
	| ConditionNode
	| ExpressionNode
	| GroupNode
	| ErrorToken<TOKEN_TYPE.VALUE>
	| undefined,

	paren: { left?: boolean, right?: boolean } = { right: true, left: true },
	parenLeftPos?: Position,
	parenRightPos?: Position
): GroupNode {
	if (expression === undefined) {
		expression = token(TOKEN_TYPE.VALUE, undefined, prefix?.end !== undefined ? { start: prefix.end } : undefined)
	}

	const node: Mutable<Partial<GroupNode>> = {
		type: AST_TYPE.GROUP,
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

	parenLeftPos = parenLeftPos ?? (start !== undefined ? { start: start - 1, end: start } : undefined)
	parenRightPos = parenRightPos ?? (end !== undefined ? { start: end, end: end + 1 } : undefined)

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

	const instance = new GroupNode(node as any)
	return instance
}
