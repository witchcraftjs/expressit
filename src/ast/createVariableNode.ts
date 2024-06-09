import { AST_TYPE, type RawNode, type VariableNode } from "../types/ast.js"

export function createVariableNode<
TValid extends boolean = boolean,
>(raw: RawNode<VariableNode<TValid>>): VariableNode<TValid> {
	return {
		...raw,
		isNode: true,
		valid: (raw.value.valid && (
			raw.quote === undefined ||
			(
				raw.quote.left.valid &&
				raw.quote.right.valid
			)
		)) as TValid,
		type: AST_TYPE.VARIABLE,
	}
}
