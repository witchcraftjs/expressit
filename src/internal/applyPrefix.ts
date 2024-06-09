import type { PrefixApplier } from "../types/parser.js"

/** @internal */
export function applyPrefix(left: string | undefined, right: string, prefixApplier: PrefixApplier): string {
	if (left === undefined) {return right}
	return prefixApplier(left, right)
}
