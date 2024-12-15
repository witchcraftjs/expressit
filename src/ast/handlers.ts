/* eslint-disable @typescript-eslint/no-shadow */

import { createArrayNode } from "./createArrayNode.js"
import { createConditionNode } from "./createConditionNode.js"
import { createExpressionNode } from "./createExpressionNode.js"
import { createGroupNode } from "./createGroupNode.js"
import { createToken } from "./createToken.js"
import { createVariableNode } from "./createVariableNode.js"

import { type AnyToken, type ArrayNode,AST_TYPE,type ConditionNode, type ErrorToken, type ExpressionNode,type FirstParam,type GroupNode, type Position, TOKEN_TYPE, type TokenBooleanTypes, type TokenDelimiterTypes, type TokenOperatorTypes, type TokenQuoteTypes, type ValidToken, type VariableNode } from "../types/ast.js"


/* #region HELPERS */
function error<T extends TOKEN_TYPE>(pos: number, expected: T[]): ErrorToken {
	if (pos === undefined) throw new Error("should never happen, passed undefined position for error token")
	return createToken({ expected, start: pos, end: pos })
}
/* #regionend */

/* #region TOKENS */
const operators = <T extends TokenOperatorTypes>
(type: T) =>
	(value: string, pos: Position): ValidToken<T> => createToken({ value, type, ...pos })

const delimiters = <T extends TokenDelimiterTypes>
(type: T) =>
	(value: string | undefined, pos: Position): ValidToken<T> | undefined =>
		// check must be falsy, we want to return undefined when given ""
		value ? createToken({ value, type, ...pos }) : undefined

const maybeToken = <T extends TOKEN_TYPE> (type: T) => <TVal extends string | undefined> (value: TVal, pos: Position): TVal extends string ? ValidToken<T> : ErrorToken => {
	if (value === undefined) {
		return error(pos.end, [type]) as any
	} else {
		return createToken({ value, type, ...pos }) as any
	}
}

export const token = {
	value: maybeToken(TOKEN_TYPE.VALUE),
	custom: maybeToken(TOKEN_TYPE.OP_CUSTOM),
	sep: maybeToken(TOKEN_TYPE.OP_EXPANDED_SEP),
}

/** We want to handle all the types outside the grammar file. This makes it easier without trying to check the value. */
export const delimiter = {
	parenL: delimiters(TOKEN_TYPE.PARENL),
	parenR: delimiters(TOKEN_TYPE.PARENR),
	bracketL: delimiters(TOKEN_TYPE.BRACKETL),
	bracketR: delimiters(TOKEN_TYPE.BRACKETR),
	double: delimiters(TOKEN_TYPE.DOUBLEQUOTE),
	single: delimiters(TOKEN_TYPE.SINGLEQUOTE),
	regex: delimiters(TOKEN_TYPE.REGEX),
	tick: delimiters(TOKEN_TYPE.BACKTICK),
	tokenError: error,
}
export const operator = {
	and: operators(TOKEN_TYPE.AND),
	or: operators(TOKEN_TYPE.OR),
	not: operators(TOKEN_TYPE.NOT),
}
/* #regionend */

/* #region AST NODES */
export function variable(
	prefix: ValidToken<TOKEN_TYPE.VALUE> | null | undefined,
	quoteL: AnyToken<TokenQuoteTypes> | null | undefined,
	value: AnyToken<TOKEN_TYPE.VALUE> | null | undefined,
	quoteR: AnyToken<TokenQuoteTypes> | null | undefined,
	flags?: ValidToken<TOKEN_TYPE.VALUE>,
): VariableNode {
	const node: FirstParam<typeof createVariableNode> = {
		prefix: prefix ?? undefined,
		value: value ?? error((prefix?.end ?? quoteL?.end ?? quoteR?.start)!, [TOKEN_TYPE.VALUE]),
		start: (prefix?.start ?? quoteL?.start ?? value?.start ?? quoteR?.start)!,
		end: (quoteR?.end ?? value?.end ?? quoteL?.end ?? prefix?.end)!,
	}

	if (quoteL || quoteR) {
		node.quote = {
			left: quoteL ?? error(node.value.start, [(quoteR!.type!)]),
			right: quoteR ?? error(node.value.end, [(quoteL!.type!)]),
		}
		if (flags) {
			node.quote.flags = flags
			node.end = node.quote?.flags?.end ?? node.end
		}
	}

	return createVariableNode(node)
}


export function condition(
	not: ValidToken<TOKEN_TYPE.NOT> | null | undefined,
	property: VariableNode | null | undefined,
	{ propertyOperator, sepL, sepR }: {
		propertyOperator?: ConditionNode["propertyOperator"] | null
		sepL?: ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP> | null
		sepR?: ValidToken<TOKEN_TYPE.OP_EXPANDED_SEP> | null
	} = {},
	value?: VariableNode | GroupNode | ArrayNode | null,
): ConditionNode {
	const start = (not?.start ?? property?.start ?? sepL?.start ?? propertyOperator?.start ?? sepR?.start ?? value?.start)!
	const end = (value?.end ?? sepR?.end ?? propertyOperator?.end ?? sepL?.end ?? property?.end ?? not?.end)!
	const node: FirstParam<typeof createConditionNode> = {
		value: value ? value : error(end, [TOKEN_TYPE.VALUE]),
		start,
		end,
	}
	if (not) { node.operator = not }
	if (property) node.property = property
	if (propertyOperator) node.propertyOperator = propertyOperator
	if (sepL || sepR) {
		node.sep = {}
		if (sepL) {
			node.sep.left = sepL
			node.property ??= error(sepL.start, [TOKEN_TYPE.VALUE])
			node.propertyOperator ??= error(sepL?.end ?? sepR?.start, [TOKEN_TYPE.VALUE])
		}
		if (sepR) node.sep.right = sepR
		else if (!node.value || node.value.type === AST_TYPE.VARIABLE) {
			node.sep.right = error(node.value?.start ?? end, [TOKEN_TYPE.OP_EXPANDED_SEP])
		}
	} else if (propertyOperator) {
		node.property ??= error(propertyOperator.start, [TOKEN_TYPE.VALUE])
	}
	return createConditionNode(node as ConditionNode)
}

export function expression(
	left: ConditionNode | GroupNode | null | undefined,
	operator: ValidToken<TokenBooleanTypes> | null | undefined,
	right: ConditionNode | GroupNode | null | undefined,
): ExpressionNode {
	return createExpressionNode({
		left: left ?? error((operator?.start ?? right?.start)!, [TOKEN_TYPE.VALUE]),
		operator: operator ?? error((left?.end ?? right?.start)!, [TOKEN_TYPE.AND, TOKEN_TYPE.OR]),
		right: right ?? error((operator?.end ?? left?.end)!, [TOKEN_TYPE.VALUE]),
		start: (left?.start ?? operator?.start ?? right?.start)!,
		end: (right?.end ?? operator?.end ?? left?.end)!,
	})
}

export function group(
	operator: ValidToken<TOKEN_TYPE.NOT> | null | undefined,
	prefix: ConditionNode | null | undefined,
	parenL: ValidToken<TOKEN_TYPE.PARENL> | null | undefined,
	condition: GroupNode["expression"],
	parenR: ValidToken<TOKEN_TYPE.PARENR> | null | undefined,
): GroupNode {
	return createGroupNode({
		prefix: prefix ?? operator ?? undefined,
		expression: condition ?? error((parenL?.end ?? parenR?.start)!, [TOKEN_TYPE.VALUE]),
		paren: {
			left: parenL ?? error((prefix?.end ?? operator?.end ?? condition?.start ?? parenR?.start)!, [TOKEN_TYPE.PARENL]),
			right: parenR ?? error((condition?.end ?? parenL?.end)!, [TOKEN_TYPE.PARENR]),
		},
		start: (prefix?.start ?? operator?.start ?? parenL?.start ?? condition?.start ?? parenR?.start)!,
		end: (parenR?.end ?? condition?.end ?? parenL?.end ?? operator?.end ?? prefix?.end)!,
	})
}

export function array(
	bracketL: ValidToken<TOKEN_TYPE.BRACKETL>,
	values: VariableNode[],
	bracketR: ValidToken<TOKEN_TYPE.BRACKETR> | null | undefined,
): ArrayNode {
	return createArrayNode({
		values,
		bracket: {
			left: bracketL, // always valid for now
			right: bracketR ?? error((values[values.length - 1]?.end ?? bracketL?.end)!, [TOKEN_TYPE.BRACKETR]),
		},
		start: bracketL.start,
		end: (bracketR?.end ?? values[values.length - 1]?.end ?? bracketL.end)!,
	})
}
/* #regionend */
