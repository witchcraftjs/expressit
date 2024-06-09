import type { Token } from "../Lexer.js"
import type { Position } from "../types/ast.js"


/** @internal */
export function extractPosition(pos: Pick<Token, "startOffset" | "endOffset">, shift: number): Position {
	return {
		start: pos.startOffset! - (shift ?? 0),
		end: pos.endOffset! + 1 - (shift ?? 0),
	}
}
