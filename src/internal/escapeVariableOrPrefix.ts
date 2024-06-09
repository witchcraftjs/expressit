import { multisplice } from "@alanscodelog/utils/multisplice.js"

export function escapeVariableOrPrefix(variable: string, preferredQuote: string): string {
	let doQuote = false
	for (const quoteType of ["\"", "'", "`"]) {
		if (!variable.includes(quoteType) && !variable.includes(" ")) continue
		if (variable.startsWith(quoteType)
								&& variable.endsWith(quoteType)) {
			break
		}
		const indexes: number[] = []
		for (let i = 0; i < variable.length; i++) {
			const char = variable[i]
			if (char === undefined) break
			if (char === "\\") {
				i += 2
				continue
			}
			if (char === " ") {
				doQuote = true
			}
			if (char === quoteType) indexes.push(i)
		}

		if (indexes.length === 0) break

		const newVal = multisplice(variable.split(""), indexes, 0, "\\").array.join("")
		variable = newVal
							
		break
	}
	if (doQuote) {
		variable = `${preferredQuote}${variable}${preferredQuote}`
	}
	return variable
}
