/* TODO TOUPDATE */
/**
 * A pre-configured parser for parsing shortcut contexts (similar to VSCode's [when clause contexts](https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts)).
 *
 * The only difference is that it does not have a regex operator since you can just do `prop == /regex/`, and because of how it has `prefixableGroups` turned on and how the parser allows groups as values, user's can use shorter queries.
 *
 * It also automatically implements a prefixApplier (variables are joined with `.`) and a value validator (which is why it requires a dummy context and a list of valid regex flags be passed). The value of the dummy context should be true to indicate the key is regexable, otherwise just false or a nested object. Any nested keys found are joined with a `.` and added to a list of valid keys. The prefixApplier is loose and allows things like `a.(b.(c))` and `a(b(c))` to both be parsed as `a.b.c`.
 *
 * The validate function will return a list of positions with a list of errors which includes handling invalid or duplicate regex flags.
 */

import { Parser } from "../parser.js"
import type { Position } from "../types/ast.js"
import type { ValueQuery } from "../types/parser.js"


export class ShortcutContextParser<T extends
	Position & { type: ("invalidKey" | "unregexableKey" | "invalidRegexFlag" | "duplicateRegexFlag") } =
	Position & { type: ("invalidKey" | "unregexableKey" | "invalidRegexFlag" | "duplicateRegexFlag") },
> extends Parser<T> {
	validKeys: string[] = []

	regexablekeys: string[] = []

	constructor(
		dummyContext: Record<string, any>,
		validRegexFlags: string[] = ["i", "u", "m"]
	) {
		super({
			arrayValues: false,
			keyParser: (key: string) => key.split(/\.+/),
			keywords: {
				and: [{ isSymbol: true, value: "&&" }],
				or: [{ isSymbol: true, value: "||" }],
				not: [{ isSymbol: true, value: "!" }],
			},
			regexValues: (property, operator) => property !== undefined && operator !== undefined,
			customPropertyOperators: ["!=", "=="],
			prefixableGroups: true,
			prefixApplier: (prefix: string, variable: string) => {
				if (!prefix.endsWith(".")) {
					return `${prefix}.${variable}`
				}
				return prefix + variable
			},
			valueComparer: (_condition, contextValue, query) => {
				if (query.isRegex) {
					return contextValue.match(new RegExp(query.value as string, query.regexFlags ?? "")) !== null
				}
				return contextValue === query.value
			},
			valueValidator: (_contextValue, query): T[] | void => {
				let tokens: T[] = []
				if (!this.validKeys.includes(query.propertyName!)) {
					tokens = tokens.concat(query.property.map(token => ({
						start: token.start,
						end: token.end,
						type: "invalidKey",
					})) as T[])
				}
				if (query.isRegex && !this.regexablekeys.includes(query.propertyName!)) {
					tokens = tokens.concat(query.property.map(token => ({
						start: token.start,
						end: token.end,
						type: "unregexableKey",
					})) as T[])
				}
				if (query.regexFlags) {
					const chars = query.regexFlags.value.split("")
					const start = query.regexFlags.start
					for (let i = 0; i < chars.length; i++) {
						const char = chars[i]
						if (chars.slice(0, i).includes(char)) {
							tokens.push({
								start: start + i,
								end: start + i + 1,
								type: "duplicateRegexFlag",
							} as T)
						}
						if (!validRegexFlags.includes(char)) {
							tokens.push({
								start: start + i,
								end: start + i + 1,
								type: "invalidRegexFlag",
							} as T)
						}
					}
				}
				if (tokens.length > 0) return tokens
			},
			conditionNormalizer({ operator, value, regexFlags, isRegex, isNegated, isQuoted }: ValueQuery) {
				let finalValue: any = value
				let finalOperator: any = operator
				// another way to allow special unquoted value types is something like this:
				if (typeof value === "string" && !isQuoted) {
					const asNum = parseInt(value, 2)
					if (!isNaN(asNum)) finalValue = asNum
					if (["true", "false"].includes(value)) {
						finalValue = value === "true"
					}
				}
				if (isRegex) {
					const val = value as string // it's always a string and never prefixed if it's a regex
					const regex = new RegExp(val, regexFlags) // this can throw if the user passes invalid flags
					finalValue = regex
				}
				if (operator) {
					switch (operator as any) {
						case "==": {
							finalOperator = "equals"
							break
						}
						case "!=": {
							finalOperator = "equals"
							isNegated = !isNegated
							break
						}
					}
				}
				return { value: finalValue, operator: finalOperator, negate: isNegated }
			},
		})
		this._extractKeysFromContext(dummyContext)
	}

	private _extractKeysFromContext(context: Record<string, any>, prev?: string): void {
		for (const key of Object.keys(context)) {
			if (typeof context[key] === "boolean") {
				this.validKeys.push(prev ? `${prev}.${key}` : key)
				if (context[key] === true) {
					this.regexablekeys.push(prev ? `${prev}.${key}` : key)
				}
			} else {
				if (typeof context[key] !== "object") throw new Error("A dummy context value must be a boolean or an object.")
				this._extractKeysFromContext(context[key], prev ? `${prev}.${key}` : key)
			}
		}
	}
}

