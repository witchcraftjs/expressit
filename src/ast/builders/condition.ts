import { pos } from "./pos.js"

import { type AnyToken, type ArrayNode, type ConditionNode, type ErrorToken, type FirstParam, type GroupNode, type Position, type TOKEN_TYPE, type ValidToken, type VariableNode } from "../../types/ast.js"
import { createConditionNode } from "../createConditionNode.js"

/**
 * Creates a {@link ConditionNode}
 *
 * @param variable An existing {@link VariableNode}
 *
 * @param not Defaults to plain true condition. To negate it you must pass an existing "not" operator {@link ValidToken} which will be set as the node's operator and set the node's value to false.
 *
 * @param property Set the property for a property operator. A property operator must be passed if this is passed.
 * @param propertyOperator Set the operator for a property condition. A property must have been passed. The property operator must be a valid token. There is no case where it would not be. If using an operator that is the same as a separator, if used as an operator, should be set as an operator.
 * @param sep Pass separator tokens for expanded property conditions.
 */
// todo doc property operator
export function condition(
	value:
	| VariableNode
	| GroupNode
	| ArrayNode
	| ErrorToken,
	not: true | ValidToken<TOKEN_TYPE.NOT> = true,
	property?: VariableNode | ErrorToken,
	propertyOperator?: AnyToken<TOKEN_TYPE.OP_CUSTOM | TOKEN_TYPE.VALUE>,
	{ right, left }: Partial<Record<"right" | "left", ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP>>> = { },
): ConditionNode {
	const position = pos(value satisfies Position)
	const notStart = not === true ? undefined : not.start
	position.start = notStart ?? property?.start ?? propertyOperator?.start ?? position.start

	const node: FirstParam<typeof createConditionNode> = {
		property,
		value,
		propertyOperator,
		...position,
	}

	if (not !== true) {
		node.operator = not
	}
	if (right || left) {
		node.sep = {}
		if (right) node.sep.right = right
		if (left) node.sep.left = left
	}

	return createConditionNode(node)
}

