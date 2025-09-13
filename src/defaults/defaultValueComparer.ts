import type { ValueComparer } from "../types/parser.js"


export const defaultValueComparer: ValueComparer =
	function defaultValueComparer(condition: { value: any }, contextValue: any) {
		return contextValue === condition.value
	}
