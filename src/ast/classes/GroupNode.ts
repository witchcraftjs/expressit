import type { ConditionNode } from "./ConditionNode"
import type { ErrorToken } from "./ErrorToken"
import type { ExpressionNode } from "./ExpressionNode"
import { Node } from "./Node"
import { ValidToken } from "./ValidToken"

import { AST_TYPE, NodeDelimiters, TOKEN_TYPE } from "@/types"


/**
 * A node that symbolizes a parenthesized expression (might be negated), and if `prefixableGroups` is enabled, a prefixed expression @see ParserOptions .
 *
 * ```txt
 * (a || b)
 *  |----| ExpressionNode
 * |------| GroupNode
 *
 * !(a || b)
 * ^ prefix: "not" Token
 *   |----| ExpressionNode
 * |-------| GroupNode
 * ```
 *
 * If `prefixableGroups` is enabled:
 * ```txt
 * prefix(a || b)
 * |----| prefix: ConditionNode
 *        |----| ExpressionNode
 * |------------| GroupNode
 *
 * !prefix(a || b)
 * |-----| prefix: ConditionNode
 *         |----| ExpressionNode
 * |-------------| GroupNode
 *
 * !(a || b)
 * ^ prefix: STILL a "not" Token
 * ```
 */

export class GroupNode<
	TValid extends boolean = boolean,
	TPrefixable extends boolean = true,
	TPrefix extends
		TPrefixable extends true
			? ConditionNode<TValid> |
			ValidToken<TOKEN_TYPE.NOT> |
			undefined
			: ValidToken<TOKEN_TYPE.NOT> |
			undefined =
		TPrefixable extends true
			? ConditionNode<TValid> |
			ValidToken<TOKEN_TYPE.NOT> |
			undefined
			: ValidToken<TOKEN_TYPE.NOT>,
>
	extends Node<AST_TYPE.GROUP> {
	/**
	 * If the condition is negated this will contain a "not" **token**, @see ValidToken .
	 *
	 * If `prefixableGroups` is enabled and the group is prefixed by a **condition**, this will be an @see ConditionNode.
	 *
	 * **Careful:** `!(a)` here this would not be a **condition** since it's just a regular negation.
	 *
	 * See examples at @see GroupNode .
	 */
	readonly prefix: TPrefix
	expression:
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| ExpressionNode<TValid>
	| (TValid extends false ? ErrorToken<TOKEN_TYPE.VALUE> : never)
	/**
	 * The parenthesis tokens, @see ValidToken . These will always be defined (although not necessarily with valid tokens).
	 */
	readonly paren: NodeDelimiters<TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR>
	#parent: any
	#setParent: boolean = false
	get parent(): ExpressionNode | undefined {
		return this.#parent
	}
	set parent(value: ExpressionNode | undefined) {
		if (this.#setParent) {throw new Error("parent property is readonly")}
		this.#parent = value
		this.#setParent = true
	}
	constructor({ prefix, expression, paren, start, end }: {
		prefix: TPrefix
		expression: GroupNode<TValid>["expression"]
		paren: GroupNode<TValid>["paren"]
		start: number
		end: number
	}) {
		super(AST_TYPE.GROUP, start, end)
		this.prefix = prefix
		this.expression = expression
		this.paren = paren
		// @ts-expect-error ignore readonly
		this.valid = (
			(
				this.prefix === undefined ||
				this.prefix instanceof ValidToken ||
				(
					this.prefix instanceof Node &&
					this.prefix.valid
				)
			) &&
			this.expression instanceof Node &&
			this.expression.valid &&
			(
				this.paren === undefined ||
				(
					this.paren.left instanceof ValidToken &&
					this.paren.right instanceof ValidToken
				)
			)
		) as TValid
	}
}

