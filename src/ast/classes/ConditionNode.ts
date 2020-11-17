import type { ArrayNode } from "./ArrayNode"
import type { ErrorToken } from "./ErrorToken"
import type { ExpressionNode } from "./ExpressionNode"
import type { GroupNode } from "./GroupNode"
import { Node } from "./Node"
import { ValidToken } from "./ValidToken"
import { VariableNode } from "./VariableNode"

import { AnyToken, AST_TYPE, TOKEN_TYPE } from "@/types"


/**
 * A condition is composed of a `variable`, @see Variable , and, if it's negated, a "not" `operator` token, @see ValidToken .
 *
 * The `value` property refers to the boolean value of the condition (not to the string value of the variable). See the `operator` property.
 */
export class ConditionNode<
	TValid extends boolean = boolean,
	TOperator extends
		ValidToken<TOKEN_TYPE.NOT> | undefined =
		ValidToken<TOKEN_TYPE.NOT> | undefined,
> extends Node<AST_TYPE.CONDITION> {
	/**
	 * Contains a value node which could be a variable, an array node (if enabled), or a group.
	 *
	 * Might be an error in cases like:
	 * - just passing a negation operator
	 * - if condition property operators are used and you have an input like just `[SEP]`, `op[SEP]`, `prop[SEP]op[SEP]`, `[CUSTOM OP]`, or `prop[CUSTOM OP]` where the variable is missing.
	 */
	readonly value:
	| VariableNode<TValid>
	| ArrayNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken<TOKEN_TYPE.VALUE> : never)
	/**
	 * If the condition was negated, contains the "not" token, @see ValidToken , the condition was negated with.
	 */
	readonly operator?: ValidToken<TOKEN_TYPE.NOT>
	/**
	 * If condition property operators are used, this will contain the property (as a variable), or an error token if it was missing (but some separator or operator was passed).
	 *
	 * While the property is a variable and can be a quoted variable, it cannot be a prefixed variable string.
	 *
	 * See the corresponding @see ParserOptions for more details.
	 */
	readonly property?: VariableNode | (TValid extends false ? ErrorToken<TOKEN_TYPE.VALUE> : never)
	/**
	 * If condition property operators are used, this will contain the operator.
	 *
	 * If a "short" form was used, this will contain an `OP_CUSTOM` type token, and the condition's `sep` will always be undefined.
	 *
	 * If a "long/expanded" form was used, this will contain a `VALUE` type token, and at least one of condition's `sep` tokens will be defined.
	 *
	 * See the corresponding @see ParserOptions for more details.
	 */
	readonly propertyOperator?: AnyToken<TOKEN_TYPE.OP_CUSTOM | TOKEN_TYPE.VALUE>
	/**
	 * If "long/expanded" form condition property operators are used, this will contain the separators, otherwise it is undefined.
	 *
	 * If it's defined, either both side will be valid tokens, or only the left, while the right might be undefined or an error token.
	 *
	 * This is because given a string like `[SEP]val` which would produce an error like `[MISSING PROPERTY ERROR][SEP]var`, the separator is always interpreted as being the left one. And even if we have a situation like `op[SEP]var`, it is always interpreted by the parser as `prop[SEP]var`.
	 *
	 * Why might the right be undefined instead of an error token? This is because we don't need a separator between the operator and a group, `prop[SEP]op(group)`, but we do between a variable in cases like `prop[SEP]op"var"` which would produce an error token on the right side (we could parse this but it just looks inconsistent).
	 *
	 * See the corresponding @see ParserOptions for more details.
	 */
	readonly sep?: {
		left?: AnyToken<TOKEN_TYPE.OP_EXPANDED_SEP>
		right?: AnyToken<TOKEN_TYPE.OP_EXPANDED_SEP>
	}
	#parent: any
	#setParent: boolean = false
	get parent(): GroupNode |
	ExpressionNode |
	undefined {
		return this.#parent
	}
	set parent(value: GroupNode |
	ExpressionNode |
	undefined
	) {
		if (this.#setParent) {throw new Error("parent property is readonly")}
		this.#parent = value
		this.#setParent = true
	}
	constructor({ property, propertyOperator, sep, value, start, end, operator }: {
		operator?: TOperator
		property?: ConditionNode<TValid>["property"]
		propertyOperator?: ConditionNode<TValid>["propertyOperator"]
		sep?: ConditionNode<TValid>["sep"]
		value: ConditionNode<TValid>["value"]
		start: number
		end: number
	}) {
		super(AST_TYPE.CONDITION, start, end)
		this.value = value
		this.operator = operator
		this.property = property
		this.propertyOperator = propertyOperator
		this.sep = sep
		this.operator = operator
		// @ts-expect-error ignore readonly
		this.valid = ((
			this.operator === undefined ||
			this.operator instanceof ValidToken
		) &&
			this.value instanceof Node &&
			this.value.valid
		) && (
			(
				this.property === undefined &&
				this.propertyOperator === undefined &&
				this.sep === undefined
			) || (
				this.property instanceof VariableNode &&
				(
					this.propertyOperator instanceof ValidToken ||
					(
						this.sep?.left instanceof ValidToken &&
						(
							this.sep.right === undefined ||
							this.sep?.right instanceof ValidToken
						)
					)
				)
			)

		) as TValid
	}
}

