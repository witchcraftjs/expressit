import { pos } from "./pos.js"

import { type AnyToken, type Position, type TOKEN_TYPE } from "../../types/ast.js"
import type { ArrayNode } from "../classes/ArrayNode.js"
import { ConditionNode } from "../classes/ConditionNode.js"
import type { ErrorToken } from "../classes/ErrorToken.js"
import type { GroupNode } from "../classes/GroupNode.js"
import type { ValidToken } from "../classes/ValidToken.js"
import type { VariableNode } from "../classes/VariableNode.js"

/**
 * Creates a @see ConditionNode
 *
 * @param variable An existing @see VariableNode
 *
 * @param not Defaults to plain true condition. To negate it you must pass an existing "not" operator @see ValidToken which will be set as the node's operator and set the node's value to false.
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
	| ErrorToken<TOKEN_TYPE.VALUE>,
	not: true | ValidToken<TOKEN_TYPE.NOT> = true,
	property?: VariableNode | ErrorToken<TOKEN_TYPE.VALUE>,
	propertyOperator?: AnyToken<TOKEN_TYPE.OP_CUSTOM | TOKEN_TYPE.VALUE>,
	{ right, left }: Partial<Record<"right" | "left", ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP>>> = { }
): ConditionNode {
	const position = pos(value satisfies Position)
	const notStart = not === true ? undefined : not.start
	position.start = notStart ?? property?.start ?? propertyOperator?.start ?? position.start

	const node: Partial<ConstructorParameters<typeof ConditionNode>[0]> = {
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
	const instance = new ConditionNode(node as any)
	return instance
}

