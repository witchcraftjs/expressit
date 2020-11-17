import type { ArrayNode } from "./ArrayNode"
import type { ConditionNode } from "./ConditionNode"
import type { ExpressionNode } from "./ExpressionNode"
import type { GroupNode } from "./GroupNode"
import { Token } from "./Token"
import type { VariableNode } from "./VariableNode"

import type { TOKEN_TYPE } from "@/types"


/**
 * The class for all *valid* tokens.
 *
 * Valid tokens always have a value, even if it might be an empty string.
 */

export class ValidToken<
	TType extends TOKEN_TYPE = TOKEN_TYPE,
> extends Token<true, TType, string, never> {
	readonly type: TType
	readonly value: string
	#parent: any
	get parent():
	| VariableNode
	| GroupNode
	| ExpressionNode
	| ConditionNode
	| ArrayNode {
		return this.#parent
	}
	set parent(value:
	| VariableNode
	| GroupNode
	| ExpressionNode
	| ConditionNode
	| ArrayNode
	) {
		if (this.#parent) {throw new Error("parent property is readonly")}
		this.#parent = value
	}
	constructor({ type, value, start, end }: {
		type: TType
		value: string
		start: number
		end: number
	}
	) {
		super(start, end)
		this.type = type
		this.value = value
	}
}
