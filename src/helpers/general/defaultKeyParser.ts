import type { KeyParser } from "@/types"


export const defaultKeyParser: KeyParser =
	function defaultKeyParser(value) {
		if (value === undefined) return []
		return [value]
	}
