import { AST_TYPE, type ConditionNode, type TOKEN_TYPE, type ValidToken } from "../types/ast.js"
import { isNode } from "../utils/isNode.js"


export function createConditionNode<
	TValid extends boolean = boolean,
	TOperator extends
		ValidToken<TOKEN_TYPE.NOT> | undefined =
		ValidToken<TOKEN_TYPE.NOT> | undefined,
>(raw: {
	operator?: TOperator
	property?: ConditionNode<TValid>["property"]
	propertyOperator?: ConditionNode<TValid>["propertyOperator"]
	sep?: ConditionNode<TValid>["sep"]
	value: ConditionNode<TValid>["value"]
	start: number
	end: number
}
): ConditionNode<TValid> {
	const valid = (
		(
			raw.operator === undefined
			|| raw.operator?.valid
		)
		&& isNode(raw.value)
		&& raw.value.valid
	)
	&& (
		(
			raw.property === undefined &&
			raw.propertyOperator === undefined &&
			raw.sep === undefined
		) || (
			raw.property !== undefined
			&& "type" in raw.property
			&& raw.property.type === AST_TYPE.VARIABLE
			&& (
				raw.propertyOperator?.valid === true
				|| (
					raw.sep?.left?.valid === true
					&& (
						raw.sep.right === undefined
						|| raw.sep?.right.valid
					)
				)
			)
		)
	)
	return {
		property: undefined,
		propertyOperator: undefined,
		sep: undefined,
		...raw,
		isNode: true,
		type: AST_TYPE.CONDITION,
		valid
	}
}
