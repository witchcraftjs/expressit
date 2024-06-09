import type { AnyFunction } from "@alanscodelog/utils/types"


export type AddParameters<T extends AnyFunction, TExtra extends any[] = [boolean]> = (...args: [...Parameters<T>, ...TExtra]) => ReturnType<T>

export enum TOKEN_TYPE {
	VALUE = "VALUE",
	AND = "AND",
	OR = "OR",
	NOT = "NOT",
	BACKTICK = "BACKTICK",
	SINGLEQUOTE = "SINGLEQUOTE",
	DOUBLEQUOTE = "DOUBLEQUOTE",
	PARENL = "PARENL",
	PARENR = "PARENR",
	BRACKETL = "BRACKETL",
	BRACKETR = "BRACKETR",
	OP_EXPANDED_SEP = "OP_EXPANDED",
	OP_CUSTOM = "OP_CUSTOM",
	REGEX = "REGEX",
}

/**
 * @internal
 * Note if the negation operator, `!`, is used as a propertyOperator, this will return the wrong type.
 */
export type ExtractTokenType<T extends string> =
	T extends "`"
	? TOKEN_TYPE.BACKTICK
	: T extends `'`
	? TOKEN_TYPE.SINGLEQUOTE
	: T extends `"`
	? TOKEN_TYPE.DOUBLEQUOTE
	: T extends `/`
	? TOKEN_TYPE.REGEX
	: T extends `(`
	? TOKEN_TYPE.PARENL
	: T extends `)`
	? TOKEN_TYPE.PARENR
	: T extends `[`
	? TOKEN_TYPE.BRACKETL
	: T extends `]`
	? TOKEN_TYPE.BRACKETR
	: T extends `and`
	? TOKEN_TYPE.AND
	: T extends `&&`
	? TOKEN_TYPE.AND
	: T extends `&`
	? TOKEN_TYPE.AND
	: T extends `or`
	? TOKEN_TYPE.OR
	: T extends `||`
	? TOKEN_TYPE.OR
	: T extends `|`
	? TOKEN_TYPE.OR
	: T extends `not`
	? TOKEN_TYPE.NOT
	: T extends `!`
	? TOKEN_TYPE.NOT
	: TOKEN_TYPE.VALUE

export type TokenParenTypes =
	| TOKEN_TYPE.PARENL
	| TOKEN_TYPE.PARENR
export type TokenBracketTypes =
	| TOKEN_TYPE.BRACKETL
	| TOKEN_TYPE.BRACKETR

export type TokenDelimiterTypes =
	| TokenParenTypes
	| TokenQuoteTypes
	| TokenBracketTypes
	| TOKEN_TYPE.OP_EXPANDED_SEP

export type TokenQuoteTypes =
	| TOKEN_TYPE.BACKTICK
	| TOKEN_TYPE.SINGLEQUOTE
	| TOKEN_TYPE.DOUBLEQUOTE
	| TOKEN_TYPE.REGEX

export type TokenBooleanTypes =
	| TOKEN_TYPE.AND
	| TOKEN_TYPE.OR

export type TokenOperatorTypes =
	| TokenBooleanTypes
	| TOKEN_TYPE.NOT

export type TokenPropertyOperatorTypes =
	| TOKEN_TYPE.OP_CUSTOM
	| TOKEN_TYPE.OP_EXPANDED_SEP


// export type EmptyObj = Record<"start"|"end", undefined>
export type EmptyObj = Record<any, never>
export type FirstParam<T extends AnyFunction> = Parameters<T>["0"]


export type Position = {
	start: number
	end: number
}

export enum AST_TYPE {
	EXPRESSION = "EXPRESSION",
	NORMALIZED_EXPRESSION = "NORMALIZED_EXPRESSION",
	GROUP = "GROUP",
	ARRAY = "ARRAY",
	CONDITION = "CONDITION",
	NORMALIZED_CONDITION = "NORMALIZED_CONDITION",
	VARIABLE = "VARIABLE",
}
// #region AST nodes


export type RawNode<T extends Node> = Omit<T, "valid" | "type" | "isNode">


/**
 * The base type from which {@link ValidToken} and {@link ErrorToken} extend.
 *
 * Mostly for internal use, and I would suggest using {@link AnyToken} instead of this for typing things.
 *
 */
export interface BaseToken {
	isToken: true
	start: number
	end: number
}
/**
 * Valid tokens always have a value, even if it might be an empty string.
 */
export interface ValidToken<TType extends TOKEN_TYPE = TOKEN_TYPE> extends BaseToken {
	valid: true
	type: TType
	value: string
}
/**
 * The type for invalid recovery tokens.
 *
 * Unlike valid tokens, error tokens:
 *
 * - Have no value.
 *
 * - Contain an extra property, `expected` with an array of tokens *that would have fixed the issue* (NOT every possible token that could be there).
 *
 * - The start end positions will always be equal. An invalid token has no length.
 */
export interface ErrorToken extends BaseToken {
	type?: undefined
	value?: undefined
	valid: false
	expected: TOKEN_TYPE[]
}

/**
 * For more easily typing tokens that might or might not be valid.
 *
 * Using {@link Token} does not work well in certain situations and is also more complex because it has so many generics.
 */
export type AnyToken<
	TType extends TOKEN_TYPE = TOKEN_TYPE,
> =
	| ValidToken<TType>
	| ErrorToken

export type RawToken<T extends AnyToken> = Omit<T, "isToken" | "valid">

export type ParserResults = ExpressionNode | ConditionNode | GroupNode | ErrorToken
/* eslint-disable @typescript-eslint/naming-convention */


/**
 * The base AST type all node types extend from.
 */

export interface Node<
	TType extends AST_TYPE = AST_TYPE,
	TValid extends boolean = boolean,
> {
	isNode: true
	type: TType
	start: number
	end: number
	valid: TValid
}


/**
 * A node that symbolizes a parenthesized expression (might be negated), and if `prefixableGroups` is enabled, a prefixed expression {@link ParserOptions} .
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
export interface GroupNode<
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
> extends Node<AST_TYPE.GROUP> {
	/**
	 * If the condition is negated this will contain a "not" **token**, {@link ValidToken} .
	 *
	 * If `prefixableGroups` is enabled and the group is prefixed by a **condition**, this will be an {@link ConditionNode}.
	 *
	 * **Careful:** `!(a)` here this would not be a **condition** since it's just a regular negation.
	 *
	 * See examples at {@link GroupNode} .
	 */
	prefix: TPrefix
	expression:
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| ExpressionNode<TValid>
	| (TValid extends false ? ErrorToken : never)
	/**
	 * The parenthesis tokens, {@link ValidToken} . These will always be defined (although not necessarily with valid tokens).
	 */
	paren: NodeDelimiters<TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR>
}


/**
 * A variable represents **just** a string value (NOT it's boolean value).
 *
 * The parser will never return just a variable, they are always wrapped in an {@link ConditionNode} to give them a boolean value.
 *
 * A variable might or might not be quoted. If it is, the `quote` property will contain the quote tokens, see {@link ValidToken} . While they will always be of the same quote type, one might be valid while the other might not (see {@link ErrorToken}).
 *
 * `value` will contain the string value of the variable. The text is not processed and might still contain escaped characters (even if unquoted!) that need to be removed to get the intended value. This is so that the position of the node is accurate. {@link evaluate} will take care of unescaping when needed.
 *
 * If `prefixableStrings` is true, the `prefix` property might contain a value token.
 */

export interface VariableNode<TValid extends boolean = boolean> extends Node<AST_TYPE.VARIABLE, TValid> {
	value: TValid extends boolean
		? AnyToken<TOKEN_TYPE.VALUE>
		: TValid extends true
		? ValidToken<TOKEN_TYPE.VALUE>
	: ErrorToken
	prefix?: ValidToken<TOKEN_TYPE.VALUE> // todo
	quote?: NodeDelimiters<TokenQuoteTypes, TokenQuoteTypes>
}

export interface ExpressionNode<TValid extends boolean = boolean> extends Node<AST_TYPE.EXPRESSION> {
	operator: AnyToken<TokenBooleanTypes>
	left:
	| ExpressionNode<TValid>
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken : never)
	right:
	| ExpressionNode<TValid>
	| ConditionNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken : never)
}


export type Nodes = ExpressionNode | ConditionNode | GroupNode | VariableNode | ArrayNode

/**
 * Contains any delimiter tokens some AST nodes ( {@link GroupNode} and {@link VariableNode} ) can have.
 *
 * These are usually not important for evaluating an expression but are useful for syntax highlighting.
 */
export type NodeDelimiters<TLEFT extends TOKEN_TYPE, TRIGHT extends TOKEN_TYPE = TLEFT> = {
	left: AnyToken<TLEFT>
	right: AnyToken<TRIGHT>
	/** Only exists if regexes are enabled and this is a regex value. */
	flags?: ValidToken<TOKEN_TYPE.VALUE>
}


export interface ArrayNode<TValid extends boolean = boolean> extends Node<AST_TYPE.ARRAY> {
	values: VariableNode[]
	bracket: NodeDelimiters<TOKEN_TYPE.BRACKETL, TOKEN_TYPE.BRACKETR>
	valid: TValid
}


/**
 * A condition is composed of a {@link Variable} , and, if it's negated, a "not" `operator` token, see {@link ValidToken}.
 *
 * The `value` property refers to the boolean value of the condition (not to the string value of the variable). See the `operator` property.
 *
 */
export interface ConditionNode<
	TValid extends boolean = boolean,
> extends Node<AST_TYPE.CONDITION> {
	/**
	 * Contains a value node which could be a variable, an array node (if enabled), or a group.
	 *
	 * Might be an error in cases like:
	 * - just passing a negation operator
	 * - if condition property operators are used and you have an input like just `[SEP]`, `op[SEP]`, `prop[SEP]op[SEP]`, `[CUSTOM OP]`, or `prop[CUSTOM OP]` where the variable is missing.
	 */
	value:
	| VariableNode<TValid>
	| ArrayNode<TValid>
	| GroupNode<TValid>
	| (TValid extends false ? ErrorToken : never)
	/**
	 * If the condition was negated, contains the "not" token, {@link ValidToken} , the condition was negated with.
	 */
	operator?: ValidToken<TOKEN_TYPE.NOT>
	/**
	 * If condition property operators are used, this will contain the property (as a variable), or an error token if it was missing (but some separator or operator was passed).
	 *
	 * While the property is a variable and can be a quoted variable, it cannot be a prefixed variable string.
	 *
	 * See the corresponding {@link ParserOptions} for more details.
	 */
	property?: VariableNode | (TValid extends false ? ErrorToken : never)
	/**
	 * If condition property operators are used, this will contain the operator.
	 *
	 * If a "short" form was used, this will contain an `OP_CUSTOM` type token, and the condition's `sep` will always be undefined.
	 *
	 * If a "long/expanded" form was used, this will contain a `VALUE` type token, and at least one of condition's `sep` tokens will be defined.
	 *
	 * See the corresponding {@link ParserOptions} for more details.
	 */
	propertyOperator?: AnyToken<TOKEN_TYPE.OP_CUSTOM | TOKEN_TYPE.VALUE>
	/**
	 * If "long/expanded" form condition property operators are used, this will contain the separators, otherwise it is undefined.
	 *
	 * If it's defined, either both side will be valid tokens, or only the left, while the right might be undefined or an error token.
	 *
	 * This is because given a string like `[SEP]val` which would produce an error like `[MISSING PROPERTY ERROR][SEP]var`, the separator is always interpreted as being the left one. And even if we have a situation like `op[SEP]var`, it is always interpreted by the parser as `prop[SEP]var`.
	 *
	 * Why might the right be undefined instead of an error token? This is because we don't need a separator between the operator and a group, `prop[SEP]op(group)`, but we do between a variable in cases like `prop[SEP]op"var"` which would produce an error token on the right side (we could parse this but it just looks inconsistent).
	 *
	 * See the corresponding {@link ParserOptions} for more details.
	 */
	sep?: {
		left?: AnyToken<TOKEN_TYPE.OP_EXPANDED_SEP>
		right?: AnyToken<TOKEN_TYPE.OP_EXPANDED_SEP>
	}
}

export interface NormalizedCondition<
	TOp extends string = string,
	TValue = any,
> {
	type: AST_TYPE.NORMALIZED_CONDITION
	value: TValue
	operator?: TOp
	property: string[]
	negate: boolean
}


export interface NormalizedExpression<TType extends string = string, TValue = any> {
	type: AST_TYPE.NORMALIZED_EXPRESSION
	left:
	| NormalizedExpression<TType, TValue>
	| NormalizedCondition<TType, TValue>
	right:
	| NormalizedExpression<TType, TValue>
	| NormalizedCondition<TType, TValue>
	operator: TokenBooleanTypes
}

export type ParentTypes<T extends Node | BaseToken | undefined> =
	T extends ValidToken
	?
	| VariableNode
	| GroupNode
	| ExpressionNode
	| ArrayNode
	| ConditionNode
	: T extends ErrorToken
	? VariableNode
	| GroupNode
	| ExpressionNode
	| ArrayNode
	| ConditionNode
	: T extends GroupNode
	? ExpressionNode | GroupNode | undefined
	: T extends VariableNode
	? ConditionNode | ArrayNode | undefined
	: T extends ExpressionNode
	? GroupNode | ExpressionNode | undefined
	: T extends ArrayNode
	? ConditionNode | undefined
	: T extends ConditionNode | ExpressionNode
	? GroupNode | undefined
	: T extends undefined
	? undefined
	: never

