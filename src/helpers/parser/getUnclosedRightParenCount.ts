import { type IToken, tokenMatcher } from "chevrotain"

import type { createTokens } from "../../grammar/createTokens.js"


/** @internal */
export function getUnclosedRightParenCount(tokens: IToken[], t: ReturnType<typeof createTokens>["tokens"]): number {
	let open = 0
	let unclosed = 0
	for (const token of tokens) {
		if (tokenMatcher(token, t.PAREN_R)) {
			if (open > 0) {
				open--
			} else {
				unclosed++
			}
		} else if (tokenMatcher(token, t.PAREN_L)) {
			open++
		}
	}
	return unclosed
}
