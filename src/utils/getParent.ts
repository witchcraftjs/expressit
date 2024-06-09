import type { generateParentsMap } from "./generateParentsMap.js"

import type { AnyToken, ArrayNode, ConditionNode, ExpressionNode, GroupNode,ParentTypes, VariableNode } from "../types/ast.js"
/** See {@link generateParentsMap} */
export function getParent<
	T extends
	| ExpressionNode
	| ConditionNode
	| GroupNode
	| VariableNode
	| ArrayNode
	| AnyToken
	| undefined,
>(node: T, map: ReturnType<typeof generateParentsMap>): ParentTypes<T> | undefined {
	return map.get(node as any) as ParentTypes<T>
}
