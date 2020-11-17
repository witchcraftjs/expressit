import type { Mutable } from "@utils/types"

import { token } from "./token"

import type { VariableNode } from "@/ast/classes"
import { ArrayNode } from "@/ast/classes/ArrayNode"
import { AST_TYPE, Position, TOKEN_TYPE } from "@/types"


export function array(
	values: VariableNode[],
	bracket: { left?: boolean, right?: boolean } = { right: true, left: true },
	parenLeftPos?: Position,
	parenRightPos?: Position
): ArrayNode {
	const node: Mutable<Partial<ArrayNode>> = {
		type: AST_TYPE.ARRAY,
		values,
	}

	node.bracket = {} as any

	const start = values[0]?.start ?? parenLeftPos?.end
	const end = values[values.length - 1]?.end ?? parenRightPos?.start ?? parenLeftPos?.end


	parenLeftPos = parenLeftPos ?? (start !== undefined ? { start: start - 1, end: start } : undefined)
	parenRightPos = parenRightPos ?? (end !== undefined ? { start: end, end: end + 1 } : undefined)

	// is always valid for now
	node.bracket!.left = token(TOKEN_TYPE.BRACKETL, "[", parenLeftPos)

	if (bracket?.right) {
		node.bracket!.right = token(TOKEN_TYPE.BRACKETR, "]", parenRightPos)
	} else {
		if (parenRightPos) {parenRightPos.end = parenRightPos.start}
		node.bracket!.right = token(TOKEN_TYPE.BRACKETR, undefined, parenRightPos)
	}

	node.start = node.bracket!.left?.start ?? start ?? node.bracket?.right.start
	node.end = node.bracket?.right?.end ?? end ?? node.bracket!.left.end

	const instance = new ArrayNode(node as any)
	return instance
}
