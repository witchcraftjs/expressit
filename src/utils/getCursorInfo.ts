import { isArray } from "@alanscodelog/utils/isArray.js"
import { unreachable } from "@alanscodelog/utils/unreachable.js"

import { extractTokens } from "./extractTokens.js"

import { type AnyToken, type ParserResults } from "../types/ast.js"
import { type CursorInfo } from "../types/autocomplete.js"


/**
 * Returns a {@link CursorInfo} object, see it for details.
 */
export function getCursorInfo(
	input: string,
	ast: ParserResults | AnyToken[],
	index: number,
): CursorInfo {
	const tokens = isArray(ast) ? ast : extractTokens(ast)

	// note: it is not enough to have the ast, we need the actual input length, otherwise leading/trailing whitespace would lead to us erroring on valid positions at the ends
	if (input.length < index || index < 0) {
		throw new Error(`Index ${index} out of bounds. Input length is ${input.length}.`)
	}

	const info: CursorInfo = {
		index,
		at: undefined,
		prev: undefined,
		next: undefined,
		valid: {
			prev: undefined,
			next: undefined,
		},
		whitespace: {
			prev: false,
			next: false,
		},
	}

	for (const token of tokens) {
		// assign valid tokens until maybe real previous token overwrites it
		if (token.end <= index) {
			if (token.valid) {
				info.prev = token
				info.valid.prev = token
			} else if (token.end !== index) {
				// there's whitespace between the prev error token and the cursor
				info.prev = token
			}
		}
		if (token.start < index && token.end > index) {
			if (!token.valid) {
				unreachable()
			} else {
				info.at = token
			}
		}
		if (token.start >= index) {
			info.next ??= token
			if (token.valid && !info.valid.next) {
				info.valid.next = token
				break
			}
		}
	}
	setWhitespaceBetween(input, index, "prev", info)
	setWhitespaceBetween(input, index, "next", info)
	return info
}

function setWhitespaceBetween(input: string, index: number, side: "prev" | "next", info: CursorInfo): void {
	/* eslint-disable no-useless-return */
	// const oppositeSide: "prev" | "next" = side === "next" ? "prev" : "next"
	const oppositePos: "start" | "end" = side === "next" ? "start" : "end"
	const pos: "start" | "end" = side === "next" ? "end" : "start"
	const limit: number = side === "next" ? input.length : 0
	// e.g. side === "next", input ends = [], cursor = |

	if (info.at) {
		if (info.valid[side]) {
			const nextTokStart = info.valid[side]![oppositePos]
			// [ aa|aa b]
			if (info.at[pos] !== nextTokStart) info.whitespace[side] = true
			// [ aa|aa&]
			else return // false
		} else {
			// [ aa|aa ]
			if (info.at[pos] !== limit) info.whitespace[side] = true
			// [ aa|aa]
			else return // false
		}
	} else {
		if (info.valid[side]) {
			const nextTokStart = info.valid[side]![oppositePos]
			// [ aa| b]
			if (index !== nextTokStart) info.whitespace[side] = true
			// [ aa|&]
			else return // false
		} else {
			// [a | ]
			if (index !== limit) info.whitespace[side] = true
			// [a |]
			else return // false
		}
	}
}
