import type { ValueComparer } from "@/types"


export const defaultValueComparer: ValueComparer =
function defaultValueComparer(condition, contextValue) {
	return contextValue === condition.value
}
