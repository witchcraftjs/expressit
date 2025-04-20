import { isFullPos } from "./isFullPos.js"

import type { AnyToken, AstType, EmptyObj, Node, Position, TokenType } from "../../types/ast.js"

/**
 * Can either:
 *
 * - Create a position from two numbers.
 * - Extract just a position from anything with a (full) position.
 * 	- From a partial position if `{fill:true}`.
 */
export function pos<TItem extends Position | Partial<Position> | EmptyObj>(
	item: TItem,
	opts: { fill: true }
): TItem extends { start: number } | { end: number }
	? Position
	: EmptyObj
export function pos<TItem extends Position | Partial<Position> | EmptyObj>(
	item: TItem,
	opts?: undefined | { fill: false }
):
	// not sure why this needs the AnyToken check
	TItem extends Position
	? Position
	: TItem extends AnyToken<TokenType> | Position | EmptyObj
	? Position | EmptyObj
	: TItem extends Node<AstType> | Position | EmptyObj
	? Position | EmptyObj
	: EmptyObj
export function pos(start: number, end: number): Position
export function pos(
	start: number | Position | Partial<Position> | EmptyObj | undefined,
	end?: number | { fill: boolean },
): Position | EmptyObj {
	if (typeof start === "number") {
		return { start, end: end as number }
	} else {
		const item = start
		if (item === undefined) return {} as any
		const fill = typeof end === "object" ? end.fill : false

		if (isFullPos(item)) {
			return { start: item.start, end: item.end }
		} else {
			if (fill) {
				/* eslint-disable @typescript-eslint/no-shadow */
				let start = item.start
				let end = item.end
				if (start !== undefined && end === undefined) end = start
				if (end !== undefined && start === undefined) start = end
				return { start: start!, end: end! }
			}
			return {} as any
		}
	}
}
