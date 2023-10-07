import type { PrefixApplier } from "../../types/parser.js"


export const defaultPrefixApplier: PrefixApplier =
function defaultPrefixApplier(prefix: string, value: string) {
	return prefix + value
}
