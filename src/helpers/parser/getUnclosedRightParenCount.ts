import { $T, type Token } from "../../Lexer.js"


/** @internal */


export function getUnclosedRightParenCount(tokens: Token[]): number {
	let open = 0
	let unclosed = 0
	for (const token of tokens) {
		if (token.type === $T.PAREN_R) {
			if (open > 0) {
				open--
			} else {
				unclosed++
			}
		} else if (token.type === $T.PAREN_L) {
			open++
		}
	}
	return unclosed
}
