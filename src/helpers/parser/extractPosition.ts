import type { Position } from "../../types/ast.js"


type ChevrotainLocation = {
	startOffset?: number
	endOffset?: number
}

/** @internal */
export function extractPosition(loc: ChevrotainLocation, shift: number): Position {
	return {
		start: loc.startOffset! - (shift ?? 0),
		end: loc.endOffset! + 1 - (shift ?? 0),
	}
}
