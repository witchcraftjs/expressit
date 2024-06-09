import type { Node } from "../types/ast.js"
/**
 * A simple wrapper around checking an object's `isNode` property that casts the object to a {@link Nodes} type for typescript.
 *
 * Does not actually do any checking of the object, and assumes the object was created using one of the `create*` functions.
 *
 * Also note that passing a NormalizedCondition or NormalizedExpression will return false even though they have their own {@link AST_TYPE} since they are not technically nodes (with positions).
 */
export function isNode(node: any): node is Node {
	return node?.isNode === true
}

