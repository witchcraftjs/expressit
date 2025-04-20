import { type } from "./type.js"

import { type ExtractToken, TOKEN_TYPE } from "../../types/ast.js"

/**
 * Faster way, more intuitive way to generate the options for matching delimiters (e.g. quotes and parens) for functions like {@link variable} and {@link group} .
 */

export function delim<
	TLeft extends boolean | string,
	TRight extends boolean | string,
	TType extends TLeft extends string
		? ExtractToken<TLeft>
		: TRight extends string
		? ExtractToken<TRight>
		: undefined,
>(
	left: TLeft = false as TLeft,
	right: TRight = false as TRight,
):
	{
		left: TLeft extends string ? true : TLeft
		right: TRight extends string ? true : TRight
	} & TType extends undefined ? Record<string,never> : { type: TType } {
	let quoteType
	if (typeof left === "string") quoteType = type(left)
	else if (typeof right === "string") quoteType = type(right)

	const opts: any = {
		left: left === true || (typeof left === "string" && left !== undefined),
		right: right === true || (typeof right === "string" && right !== undefined),
	}
	if (quoteType !== undefined &&
		!([TOKEN_TYPE.PARENL, TOKEN_TYPE.PARENR] as string[]).includes(quoteType)
	) {
		opts.type = quoteType
	}
	return opts
}
