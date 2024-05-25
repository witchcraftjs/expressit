import type { ConditionNode } from "./ConditionNode.js"
import type { ExpressionNode } from "./ExpressionNode.js"
import type { GroupNode } from "./GroupNode.js"
import { Token } from "./Token.js"
import type { VariableNode } from "./VariableNode.js"

import type { TOKEN_TYPE } from "../../types/ast.js"

/**
 * The class for invalid recovery tokens.
 *
 * Unlike valid tokens, error tokens:
 *
 * - Have no value.
 * - Contain an extra property, `expected` with an array of tokens *that would have fixed the issue* (NOT every possible token that could be there).
 * - The start end positions will always be equal. An invalid token has no length.
 */
export class ErrorToken<
	TExpected extends TOKEN_TYPE = TOKEN_TYPE,
> extends Token<false, never, never, TExpected[]> {
	readonly expected: TExpected[]

	#parent: any

	get parent(): VariableNode |
	GroupNode |
	ExpressionNode |
	ConditionNode {
		return this.#parent
	}

	set parent(value: VariableNode |
	GroupNode |
	ExpressionNode |
	ConditionNode,
	) {
		if (this.#parent) {throw new Error("parent property is readonly")}
		this.#parent = value
	}

	constructor({ expected, start, end }: {
		expected: TExpected[]
		start: number
		end: number
	}) {
		super(start, end)
		this.expected = expected
	}
}
