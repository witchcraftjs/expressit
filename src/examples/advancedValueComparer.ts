import type { ValueQuery } from "@/types"

/* TODO TOUPDATE */
type Operators = ">" | "contains"
type Prefixes = "num"
export function valueComparer(contextValue: string, { operator, prefix, value, isRegex, regexFlags }: ValueQuery): boolean {
	let finalValue: any = value
	if (prefix) {
		const val = value as string // it's always a string if prefixed
		switch (prefix as Prefixes) {
			case "num": finalValue = parseInt(val, 2); break
			// ...
		}
	}
	if (isRegex) {
		const val = value as string // it's always a string and never prefixed if it's a regex
		const regex = new RegExp(val, regexFlags)
		return contextValue.match(regex) !== null
	}
	if (operator) {
		switch (operator as Operators) {
			// custom operators
			case ">": return contextValue > finalValue
			// ...
			// custom expanded operators
			case "contains": return contextValue.includes(finalValue)
			// ...
		}
	}
	return contextValue === finalValue
}
