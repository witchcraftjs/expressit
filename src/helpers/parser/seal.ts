import { assignParents } from "./assignParents.js"

import { Node } from "../../ast/classes/Node.js"
import type { AnyToken, Nodes } from "../../types/ast.js"

/**
 * set and "seals" all parent properties
 *
 * @internal
 */
export function seal(ast: Nodes | AnyToken): void {
	if (ast instanceof Node) assignParents(ast)
	ast.parent = undefined
}
