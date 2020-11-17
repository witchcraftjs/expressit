import type { ConditionNode } from "./ConditionNode"
import { Node } from "./Node"
import { ValidToken } from "./ValidToken"
import type { VariableNode } from "./VariableNode"

import { AST_TYPE, NodeDelimiters, TOKEN_TYPE } from "@/types"


export class ArrayNode<
	TValid extends boolean = boolean,
> extends Node<AST_TYPE.ARRAY> {
	readonly values: VariableNode[]
	readonly bracket: NodeDelimiters<TOKEN_TYPE.BRACKETL, TOKEN_TYPE.BRACKETR>
	#parent: any
	#setParent: boolean = false
	get parent(): ConditionNode | undefined {
		return this.#parent
	}
	set parent(value: ConditionNode | undefined) {
		if (this.#setParent) { throw new Error("parent property is readonly") }
		this.#parent = value
		this.#setParent = true
	}
	constructor({ values, bracket, start, end }: {
		values: ArrayNode<TValid>["values"]
		bracket: ArrayNode<TValid>["bracket"]
		start: number
		end: number
	}) {
		super(AST_TYPE.ARRAY, start, end)
		this.values = values
		this.bracket = bracket
		// @ts-expect-error ignore readonly
		this.valid = (
			this.values.every(val => val.valid) &&
			this.bracket.left instanceof ValidToken &&
			this.bracket.right instanceof ValidToken
		) as TValid
	}
}
