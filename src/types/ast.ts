import type { AnyFunction } from "@alanscodelog/utils/types"

import type { ArrayNode, ConditionNode, ErrorToken, ExpressionNode, GroupNode, ValidToken, VariableNode } from "../ast/classes/index.js"

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
export type FirstConstructorParam<T extends new (...args: any) => any> = ConstructorParameters<T>["0"]

export type Position = {
	start: number
	end: number
}

export enum AST_TYPE {
	EXPRESSION = "EXPRESSION",
	GROUP = "GROUP",
	ARRAY = "ARRAY",
	CONDITION = "CONDITION",
	VARIABLE = "VARIABLE",
}

// #region AST nodes

/**
 * For more easily typing tokens that might or might not be valid.
 *
 * Using @see Token does not work well in certain situations and is also more complex because it has so many generics.
 */
export type AnyToken<
	TType extends TOKEN_TYPE = TOKEN_TYPE,
> =
	| ValidToken<TType>
	| ErrorToken<TType>

export type ParserResults = ExpressionNode | ConditionNode | GroupNode | ErrorToken<TOKEN_TYPE.VALUE>
/* eslint-disable @typescript-eslint/naming-convention */


export type Nodes = ExpressionNode | ConditionNode | GroupNode | VariableNode | ArrayNode

/**
 * Contains any delimiter tokens some AST nodes ( @see GroupNode and @see VariableNode ) can have.
 *
 * These are usually not important for evaluating an expression but are useful for syntax highlighting.
 */
export type NodeDelimiters<TLEFT extends TOKEN_TYPE, TRIGHT extends TOKEN_TYPE = TLEFT> = {
	left: AnyToken<TLEFT>
	right: AnyToken<TRIGHT>
	/** Only exists if regexes are enabled and this is a regex value. */
	flags?: ValidToken<TOKEN_TYPE.VALUE>
}
