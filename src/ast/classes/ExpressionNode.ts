import type { ConditionNode } from "./ConditionNode"
import type { ErrorToken } from "./ErrorToken"
import type { GroupNode } from "./GroupNode"
import { Node } from "./Node"
import { ValidToken } from "./ValidToken"

import { AnyToken, AST_TYPE, TOKEN_TYPE, TokenBooleanTypes } from "@/types"


export class ExpressionNode<
	TValid extends boolean = boolean,
>
	extends Node<AST_TYPE.EXPRESSION> {
	readonly operator: AnyToken<TokenBooleanTypes>
	readonly left:
	| ExpressionNode<TValid>
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken<TOKEN_TYPE.VALUE> : never)
	readonly right:
	| ExpressionNode<TValid>
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken<TOKEN_TYPE.VALUE> : never)
	#parent: any
	#setParent: boolean = false
	get parent(): GroupNode | undefined {
		return this.#parent
	}
	set parent(value: GroupNode | undefined) {
		if (this.#setParent) {throw new Error("parent property is readonly")}
		this.#parent = value
		this.#setParent = true
	}
	constructor({ operator, left, right, start, end }: {
		operator: ExpressionNode<TValid>["operator"]
		right: ExpressionNode<TValid>["right"]
		left: ExpressionNode<TValid>["left"]
		start: number
		end: number
	}) {
		super(AST_TYPE.EXPRESSION, start, end)
		this.operator = operator
		this.right = right
		this.left = left
		// @ts-expect-error ignore readonly
		this.valid = (
			this.operator instanceof ValidToken &&
			this.left instanceof Node &&
			this.left.valid &&
			this.right instanceof Node &&
			this.right.valid
		) as TValid
	}
}
