/* eslint-disable @typescript-eslint/no-shadow */

import { ArrayNode } from "./classes/ArrayNode.js"
import { ConditionNode } from "./classes/ConditionNode.js"
import { ErrorToken } from "./classes/ErrorToken.js"
import { ExpressionNode } from "./classes/ExpressionNode.js"
import { GroupNode } from "./classes/GroupNode.js"
import { ValidToken } from "./classes/ValidToken.js"
import { VariableNode } from "./classes/VariableNode.js"

import { type AnyToken, type FirstConstructorParam, type Position, TOKEN_TYPE, type TokenBooleanTypes, type TokenDelimiterTypes, type TokenOperatorTypes, type TokenQuoteTypes } from "../types/ast.js"


/* #region HELPERS */
function error<T extends TOKEN_TYPE>(pos: number, expected: T[]): ErrorToken<T> {
	if (pos === undefined) throw new Error("should never happen, passed undefined position for error token")
	return new ErrorToken({ expected, start: pos, end: pos })
}
/* #regionend */

/* #region TOKENS */
const operators = <T extends TokenOperatorTypes>
(type: T) =>
	(value: string, pos: Position): ValidToken<T> => new ValidToken({ value, type, ...pos })

const delimiters = <T extends TokenDelimiterTypes>
(type: T) =>
	(value: string | undefined, pos: Position): ValidToken<T> | undefined =>
		// check must be falsy, we want to return undefined when given ""
		value ? new ValidToken({ value, type, ...pos }) : undefined

const maybeToken = <T extends TOKEN_TYPE> (type: T) => <TVal extends string | undefined> (value: TVal, pos: Position): TVal extends string ? ValidToken<T> : ErrorToken<T> => {
	if (value === undefined) {
		return error(pos.end, [type]) as any
	} else {
		return new ValidToken({ value, type, ...pos }) as any
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
	const node: FirstConstructorParam<typeof VariableNode> = {
		prefix: prefix ?? undefined,
		value: value ?? error((prefix?.end ?? quoteL?.end ?? quoteR?.start)!, [TOKEN_TYPE.VALUE]),
		start: (prefix?.start ?? quoteL?.start ?? value?.start ?? quoteR?.start)!,
		end: (quoteR?.end ?? value?.end ?? quoteL?.end ?? prefix?.end)!,
	}

	if (quoteL || quoteR) {
		node.quote = {
			left: quoteL ?? error(node.value.start, [(quoteR!.type)]),
			right: quoteR ?? error(node.value.end, [(quoteL!.type)]),
		}
		if (flags) {
			node.quote.flags = flags
			node.end = node.quote?.flags.end
		}
	}

	const instance = new VariableNode(node as any)
	return instance
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
	const node: FirstConstructorParam<typeof ConditionNode> = {
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
			node.property ||= error(sepL.start, [TOKEN_TYPE.VALUE])
			node.propertyOperator ||= error(sepL?.end ?? sepR?.start, [TOKEN_TYPE.VALUE])
		}
		if (sepR) node.sep.right = sepR
		else if (!node.value || node.value instanceof VariableNode) {
			node.sep.right = error(node.value?.start ?? end, [TOKEN_TYPE.OP_EXPANDED_SEP])
		}
	} else if (propertyOperator) {
		node.property ||= error(propertyOperator.start, [TOKEN_TYPE.VALUE])
	}

	const instance = new ConditionNode(node as any)
	return instance
}

export function expression(
	left: ConditionNode | GroupNode | null | undefined,
	operator: ValidToken<TokenBooleanTypes> | null | undefined,
	right: ConditionNode | GroupNode | null | undefined,
): ExpressionNode {
	const instance = new ExpressionNode({
		left: left ?? error((operator?.start ?? right?.start)!, [TOKEN_TYPE.VALUE]),
		operator: operator ?? error((left?.end ?? right?.start)!, [TOKEN_TYPE.AND, TOKEN_TYPE.OR]),
		right: right ?? error((operator?.end ?? left?.end)!, [TOKEN_TYPE.VALUE]),
		start: (left?.start ?? operator?.start ?? right?.start)!,
		end: (right?.end ?? operator?.end ?? left?.end)!,
	})
	return instance
}

export function group(
	operator: ValidToken<TOKEN_TYPE.NOT> | null | undefined,
	prefix: ConditionNode | null | undefined,
	parenL: ValidToken<TOKEN_TYPE.PARENL> | null | undefined,
	condition: GroupNode["expression"],
	parenR: ValidToken<TOKEN_TYPE.PARENR> | null | undefined,
): GroupNode {
	const node: FirstConstructorParam<typeof GroupNode> = {
		prefix: prefix ?? operator ?? undefined,
		expression: condition ?? error((parenL?.end ?? parenR?.start)!, [TOKEN_TYPE.VALUE]),
		paren: {
			left: parenL ?? error((prefix?.end ?? operator?.end ?? condition?.start ?? parenR?.start)!, [TOKEN_TYPE.PARENL]),
			right: parenR ?? error((condition?.end ?? parenL?.end)!, [TOKEN_TYPE.PARENR]),
		},
		start: (prefix?.start ?? operator?.start ?? parenL?.start ?? condition?.start ?? parenR?.start)!,
		end: (parenR?.end ?? condition?.end ?? parenL?.end ?? operator?.end ?? prefix?.end)!,
	}

	const instance = new GroupNode(node as any)
	return instance
}

export function array(
	bracketL: ValidToken<TOKEN_TYPE.BRACKETL>,
	values: VariableNode[],
	bracketR: ValidToken<TOKEN_TYPE.BRACKETR> | null | undefined,
): ArrayNode {
	const node: FirstConstructorParam<typeof ArrayNode> = {
		values,
		bracket: {
			left: bracketL, // always valid for now
			right: bracketR ?? error((values[values.length - 1]?.end ?? bracketL?.end)!, [TOKEN_TYPE.BRACKETR]),
		},
		start: bracketL.start,
		end: (bracketR?.end ?? values[values.length - 1]?.end ?? bracketL.end)!,
	}

	const instance = new ArrayNode(node as any)
	return instance
}
/* #regionend */
