import type { Position } from "../../types/ast.js"

/**
 * @internal
 */
export function isFullPos(position?: Partial<Position> | any): position is Position {
	return typeof position === "object" &&
		position.start !== undefined &&
		position.end !== undefined
}
