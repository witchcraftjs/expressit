import type { ArrayNode } from "./ArrayNode"
import type { ConditionNode } from "./ConditionNode"
import type { ErrorToken } from "./ErrorToken"
import { Node } from "./Node"
import { ValidToken } from "./ValidToken"

import { AnyToken, AST_TYPE, NodeDelimiters, TOKEN_TYPE, TokenQuoteTypes } from "@/types"


/**
 * A variable represents **just** a string value (NOT it's boolean value).
 *
 * The parser will never return just a variable, they are always wrapped in an @see ConditionNode to give them a boolean value.
 *
 * A variable might or might not be quoted. If it is, the `quote` property will contain the quote tokens, @see ValidToken . While they will always be of the same quote type, one might be valid while the other might not (@see ErrorToken).
 *
 * `value` will contain the string value of the variable. The text is not processed and might still contain escaped characters (even if unquoted!) that need to be removed to get the intended value. This is so that the position of the node is accurate. @see evaluate will take care of unescaping when needed.
 *
 * If `prefixableStrings` is true, the `prefix` property might contain a value token.
 */

export class VariableNode<
	TValid extends boolean = boolean,
> extends Node<AST_TYPE.VARIABLE, TValid> {
	readonly value: TValid extends boolean
		? AnyToken<TOKEN_TYPE.VALUE>
		: TValid extends true
		? ValidToken<TOKEN_TYPE.VALUE>
	: ErrorToken<TOKEN_TYPE.VALUE>
	readonly prefix?: ValidToken<TOKEN_TYPE.VALUE> // todo
	readonly quote?: NodeDelimiters<TokenQuoteTypes, TokenQuoteTypes>
	#parent: any
	#setParent: boolean = false
	get parent(): ConditionNode | ArrayNode | undefined {
		return this.#parent
	}
	set parent(value: ConditionNode | ArrayNode | undefined) {
		if (this.#setParent) {throw new Error("parent property is readonly")}
		this.#parent = value
		this.#setParent = true
	}
	constructor({ prefix, value, quote, start, end }: {
		prefix?: VariableNode<TValid>["prefix"]
		value: VariableNode<TValid>["value"]
		quote?: VariableNode<TValid>["quote"]
		start: number
		end: number
	}) {
		super(AST_TYPE.VARIABLE, start, end)
		this.prefix = prefix
		this.value = value
		this.quote = quote
		// @ts-expect-error ignore readonly
		this.valid = (this.value instanceof ValidToken && (
			this.quote === undefined ||
			(
				this.quote.left instanceof ValidToken &&
				this.quote.right instanceof ValidToken
			)
		)) as TValid
	}
}
