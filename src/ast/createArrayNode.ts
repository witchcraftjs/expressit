import { type ArrayNode, AST_TYPE, type RawNode } from "../types/ast.js"


export function createArrayNode<TValid extends boolean = boolean>(
	raw: RawNode<ArrayNode<TValid>>
): ArrayNode<TValid> {
	return {
		type: AST_TYPE.ARRAY,
		isNode: true,
		valid: (
			raw.values.every(val => val.valid) &&
			raw.bracket.left.valid &&
			raw.bracket.right.valid
		) as TValid,
		...raw
	}
}
