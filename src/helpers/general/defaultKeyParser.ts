import type { KeyParser } from "../../types/parser.js"


export const defaultKeyParser: KeyParser =
	function defaultKeyParser(value?: string) {
		if (value === undefined) return []
		return [value]
	}
