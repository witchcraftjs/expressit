import { assignParents } from "./assignParents"

import { Node } from "@/ast/classes"
import type { AnyToken, Nodes } from "@/types"


/**
 * set and "seals" all parent properties
 *
 * @internal
 */
export function seal(ast: Nodes | AnyToken): void {
	if (ast instanceof Node) assignParents(ast)
	ast.parent = undefined
}
