import { pos } from "./pos.js"
import { token } from "./token.js"

import { type AnyToken, type EmptyObj, type Position, TOKEN_TYPE, type TokenQuoteTypes } from "../../types/ast.js"
import type { ValidToken } from "../classes/ValidToken.js"
import { VariableNode } from "../classes/VariableNode.js"


/**
 * Creates an @see VariableNode .
 *
 * @param quote Use to add quotes to the variable, usually by using @see delim . If false or undefined, no quotes are added. Otherwise at least `type` must be passed.  If one side is defined but not the other, error tokens will be created with the given type.
 *
 * @param position Refers to position of the value (in case it needs to be created) not the node. Quote positions are automatically calculated from this if used. If value is already a token, there's no need to pass a position, it can be extracted from the token.
 */

export function variable(
	prefix: ValidToken<TOKEN_TYPE.VALUE> | undefined,
	value: string | AnyToken<TOKEN_TYPE.VALUE>,
	quote?: { type: TokenQuoteTypes, left?: boolean, right?: boolean, flags?: string },
	position?: Position | EmptyObj
): VariableNode {
	if (typeof value === "string") {
		value = token(TOKEN_TYPE.VALUE, value, position)
	}

	position = pos(value)

	const node: Partial<ConstructorParameters<typeof VariableNode>[0]> = {
		value,
		prefix,
	}

	if (quote) {
		node.quote = {} as any

		const quoteLeftPos = position?.start !== undefined
			? pos({ start: position.start }, { fill: true })
			: undefined

		if (quote.left) {
			if (quoteLeftPos) quoteLeftPos.start -= 1
			node.quote!.left = token(quote.type, quoteFromType(quote.type), quoteLeftPos)
		} else {
			node.quote!.left = token(quote.type, undefined, quoteLeftPos)
		}

		const quoteRightPos = position?.end !== undefined
			? pos({ end: position.end }, { fill: true })
			: undefined

		if (quote.right) {
			if (quoteRightPos) quoteRightPos.end += 1
			node.quote!.right = token(quote.type, quoteFromType(quote.type), quoteRightPos)
		} else {
			node.quote!.right = token(quote.type, undefined, quoteRightPos)
		}
		if (quote.flags) {
			const start = node.quote!.right.end // is always defined if there are flags
			node.quote!.flags = token(TOKEN_TYPE.VALUE, quote.flags, {
				start, end: start + quote.flags?.length,
			})
		}
	}

	node.start =
		node.prefix?.start ??
		node.quote?.left.start ??
		node.value?.start ??
		node.quote?.right.start
	node.end =
		node.quote?.flags?.end ??
		node.quote?.right.end ??
		node.value?.end ??
		node.quote?.left.end

	const instance = new VariableNode(node as any)
	return instance
}

function quoteFromType(type: TokenQuoteTypes | undefined): string {
	switch (type) {
		case TOKEN_TYPE.BACKTICK: return "`"
		case TOKEN_TYPE.DOUBLEQUOTE: return "\""
		case TOKEN_TYPE.SINGLEQUOTE: return "'"
		case TOKEN_TYPE.REGEX: return "/"
		case undefined: return ""
	}
}
