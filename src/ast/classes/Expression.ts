import type { Condition } from "./Condition.js"

import type { TokenBooleanTypes } from "../../types/ast.js"


export class Expression<TType extends string = string, TValue = any> {
	readonly left:
	| Expression<TType, TValue>
	| Condition<TType, TValue>

	readonly right:
	| Expression<TType, TValue>
	| Condition<TType, TValue>

	readonly operator: TokenBooleanTypes

	constructor({ operator, left, right }: {
		operator: Expression<TType, TValue>["operator"]
		right: Expression<TType, TValue>["right"]
		left: Expression<TType, TValue>["left"]
	}) {
		this.operator = operator
		this.right = right
		this.left = left
	}
}
