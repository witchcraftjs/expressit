import { AST_TYPE, type ConditionNode, type GroupNode, type RawNode, type TOKEN_TYPE, type ValidToken } from "../types/ast.js"
import { isNode } from "../utils/isNode.js"
import { isToken } from "../utils/isToken.js"


export function createGroupNode<
	TValid extends boolean = boolean,
	TPrefixable extends boolean = true,
	TPrefix extends
		TPrefixable extends true
			? ConditionNode<TValid> |
			ValidToken<typeof TOKEN_TYPE.NOT> |
			undefined
			: ValidToken<typeof TOKEN_TYPE.NOT> |
			undefined =
		TPrefixable extends true
			? ConditionNode<TValid> |
			ValidToken<typeof TOKEN_TYPE.NOT> |
			undefined
			: ValidToken<typeof TOKEN_TYPE.NOT>,
>(raw: {
	prefix: TPrefix
} & RawNode<GroupNode<TValid>>): GroupNode<TValid, TPrefixable, TPrefix> {
	return {
		...raw,
		isNode: true,
		valid: (
			(
				raw.prefix === undefined
				|| (isToken(raw.prefix) && raw.prefix.valid)
				|| (isNode(raw.prefix) && raw.prefix.valid)
			)
			&& isNode(raw.expression)
			&& raw.expression.valid
			&& (
				raw.paren === undefined
				|| (
					raw.paren.left.valid
					&& raw.paren.right.valid
				)
			)
		),
		type: AST_TYPE.GROUP,
	}
}
		
