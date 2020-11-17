import type { PrefixApplier } from "@/types"


export const defaultPrefixApplier: PrefixApplier =
function defaultPrefixApplier(prefix, value) {
	return prefix + value
}
