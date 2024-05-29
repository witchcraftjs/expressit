/* eslint-disable max-lines */
import type { DeepPartial } from "@alanscodelog/utils"
import { catchError } from "@alanscodelog/utils/catchError.js"
import { describe, expect, it } from "vitest"

import { findPos } from "./utils.js"

import { Parser } from "../src/Parser.js"
import type { AnyToken, Position } from "../src/types/ast.js"
import { type CursorInfo, type Suggestion, SUGGESTION_TYPE } from "../src/types/autocomplete.js"
import { getCursorInfo } from "../src/utils/getCursorInfo.js"


const emptyCursor: Omit<CursorInfo, "index"> = Object.freeze({
	at: undefined,
	next: undefined,
	prev: undefined,
	valid: {
		next: undefined,
		prev: undefined,
	},
	whitespace: {
		prev: false,
		next: false,
	},
})

function createCursor(cursor: DeepPartial<CursorInfo>): CursorInfo {
	const res = {
		...emptyCursor,
		...cursor,
		valid: {
			...emptyCursor.valid,
			...cursor.valid,
		},
		whitespace: {
			...emptyCursor.whitespace,
			...cursor.whitespace,
		},
	}
	if (res.index === undefined) throw new Error("missing cursor index")
	return res as unknown as CursorInfo
}

const suggest = (type: SUGGESTION_TYPE | string, range: Position, before: boolean = false, after: boolean = false, group: boolean = false, prefix?: string | false) => ({
	type: type.includes("ERROR.") ? type.replace("ERROR.", "") : type,
	range,
	requires: {
		whitespace: { before, after },
		group,
		prefix: prefix ?? false,
	},
	isError: !!type.includes("ERROR."),
})

/** Remove the cursorInfo from the suggestions list. It is always the same for all entries and it is checked separately for 99% of tests anyways. */
const simplify = (suggestions: Suggestion[]): Omit<Suggestion, "cursorInfo">[] => suggestions.map(suggestion => {
	const clone = { ...suggestion }
	// @ts-expect-error we need to actually delete the key, not just set it undefined
	delete clone.cursorInfo
	return clone
})
// todo unify genExpected* functions
const rawPrefixes = ["prefix", `quoted prefix`, `prefix"requires"escape`]
const prefixes = ["prefix", `"quoted prefix"`, `"prefix\\"requires\\"escape"`]
const genExpectedPrefixes = (suggestion: Suggestion) => prefixes.map(value => ({ suggestion, value }))

const rawVariables = ["variable", `quoted variable`, `variable"requires"escape`]
const variables = ["variable", `"quoted variable"`, `"variable\\"requires\\"escape"`]
const genExpectedVariables = (suggestion: Suggestion) => variables.map(value => ({ suggestion, value }))

const wordOperators = ["and", "AND", "or", "OR"]
const symOperators = ["&&", "&", "||", "|"]
const genExpectedSymbolOperators = (suggestion: Suggestion) => symOperators.map(value => ({ suggestion, value }))
const genExpectedWordOperators = (suggestion: Suggestion) => wordOperators.map(value => ({ suggestion, value }))

const quote = "\""

const regexFlags = ["i", "m", "u"]
const genExpectedRegexFlags = (suggestion: Suggestion) => regexFlags.map(value => ({ suggestion, value }))
const expandedPropertyOperators = ["OP"]
const genExpectedExpOps = (suggestion: Suggestion) => expandedPropertyOperators.map(value => ({ suggestion, value }))
const customPropertyOperators = ["=", "<>"]
const genExpectedCustomOps = (suggestion: Suggestion) => customPropertyOperators.map(value => ({ suggestion, value }))
const properties = ["prop"]
const genExpectedProps = (suggestion: Suggestion) => properties.map(value => ({ suggestion, value }))
const rawArrayValues = ["value", `quoted value`, `value"requires"escape`]
const arrayValues = ["value", `"quoted value"`, `"value\\"requires\\"escape"`]
const genExpectedArrayValues = (suggestion: Suggestion) => arrayValues.map(value => ({ suggestion, value }))
const rawValues = ["value", `quoted value`, `value"requires"escape`]
const values = ["value", `"quoted value"`, `"value\\"requires\\"escape"`]
const genExpectedValues = (suggestion: Suggestion) => values.map(value => ({ suggestion, value }))
const completionOpts: Parameters<Parser["autocomplete"]>[1] = {
	prefixes: rawPrefixes,
	variables: rawVariables,
	arrayValues: rawArrayValues,
	values: rawValues,
	quote,
	regexFlags,
	expandedPropertyOperators,
	customPropertyOperators,
	properties,
}

describe("basic edge cases", () => {
	it("empty input", () => {
		const input = ""
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			next: ast as AnyToken,
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, findPos(input, ""), false, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, findPos(input, "")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `${prefix}()`, cursor: `${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable}`, cursor: `${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a | EOI (out of bounds (of tokens))", () => {
		const input = "a  "
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).value.value,
			valid: {
				prev: (ast as any).value.value,
			},
			whitespace: {
				prev: true,
				next: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.BOOLEAN_WORD_OP, { start: index, end: index }),
		])


		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedSymbolOperators(suggestions[0]),
			...genExpectedWordOperators(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...[...symOperators, ...wordOperators]
					.map(op => ({ replacement: `a ${op} `, cursor: `a ${op}| `.lastIndexOf("|") })),
			])
	})
	it("a | EOI (with onMissingBooleanOperator !== error) ", () => {
		const input = "a  "
		const index = 2
		const parser = new Parser({ onMissingBooleanOperator: "and" })
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).value.value,
			valid: {
				prev: (ast as any).value.value,
			},
			whitespace: {
				prev: true,
				next: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.PREFIX, { start: index, end: index }, false, false, true),
			suggest(SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.BOOLEAN_WORD_OP, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedVariables(suggestions[0]),
			...genExpectedPrefixes(suggestions[1]),
			...genExpectedSymbolOperators(suggestions[2]),
			...genExpectedWordOperators(suggestions[3]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...variables.map(variable => ({ replacement: `a ${variable} `, cursor: `a ${variable}| `.lastIndexOf("|") })),
				...prefixes.map(prefix => ({ replacement: `a ${prefix}() `, cursor: `a ${prefix}(|) `.lastIndexOf("|") })),
				...[...symOperators, ...wordOperators]
					.map(op => ({ replacement: `a ${op} `, cursor: `a ${op}| `.lastIndexOf("|") })),
			])
	})
	it("a EOI | (out of bounds (of real input))", () => {
		const input = "a"
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		expect((catchError(() => {
			getCursorInfo(input, ast, index)
		})).message).to.include("out of bounds")
		expect((catchError(() => {
			parser.autosuggest(input, ast, index)
		})).message).to.include("out of bounds")
	})
})
describe("basic", () => {
	it("|a", () => {
		const input = "a"
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			next: (ast as any).value.value,
			valid: {
				next: (ast as any).value.value,
			},
			index,
		})

		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "a"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "a")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `${prefix}()`, cursor: `${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable}`, cursor: `${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a|", () => {
		const input = "a"
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).value.value,
			valid: {
				prev: (ast as any).value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "a"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "a")),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `${prefix}()`, cursor: `${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable}`, cursor: `${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a|()", () => {
		const input = "a()"
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).prefix.value.value,
			next: (ast as any).paren.left,
			valid: {
				prev: (ast as any).prefix!.value.value,
				next: (ast as any).paren.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "a")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `${prefix}()`, cursor: `${prefix}|()`.lastIndexOf("|") })),
			])
	})
	it("a(|)", () => {
		const input = "a()"
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).paren.left,
			next: (ast as any).expression,
			valid: {
				next: (ast as any).paren.right,
				prev: (ast as any).paren.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, { start: index, end: index }, false, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a(${prefix}())`, cursor: `a(${prefix}(|))`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a(${variable})`, cursor: `a(${variable}|)`.lastIndexOf("|") })),
			])
	})
	it("a- b", () => {
		const input = "a b"
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).left.value.value,
			next: (ast as any).operator,
			valid: {
				prev: (ast as any).left.value.value,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				next: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_WORD_OP}`, { start: index, end: index }, true, false),
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "a"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "a")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedSymbolOperators(suggestions[0]),
			...genExpectedWordOperators(suggestions[1]),
			...genExpectedPrefixes(suggestions[2]),
			...genExpectedVariables(suggestions[3]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...symOperators.map(op => ({ replacement: `a${op} b`, cursor: `a${op}| b`.lastIndexOf("|") })),
				...wordOperators.map(op => ({ replacement: `a ${op} b`, cursor: `a ${op}| b`.lastIndexOf("|") })),
				...prefixes.map(prefix => ({ replacement: `${prefix}() b`, cursor: `${prefix}(|) b`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable} b`, cursor: `${variable}| b`.lastIndexOf("|") })),
			])
	})
	it("a |b", () => {
		const input = "a b"
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.value.value,
			valid: {
				prev: (ast as any).left.value.value,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_WORD_OP}`, { start: index, end: index }, false, true),
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "b"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "b")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedSymbolOperators(suggestions[0]),
			...genExpectedWordOperators(suggestions[1]),
			...genExpectedPrefixes(suggestions[2]),
			...genExpectedVariables(suggestions[3]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...symOperators.map(op => ({ replacement: `a ${op}b`, cursor: `a ${op}|b`.lastIndexOf("|") })),
				...wordOperators.map(op => ({ replacement: `a ${op} b`, cursor: `a ${op}| b`.lastIndexOf("|") })),
				...prefixes.map(prefix => ({ replacement: `a ${prefix}()`, cursor: `a ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a ${variable}`, cursor: `a ${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a b|", () => {
		const input = "a b"
		const index = 3
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right.value.value,
			valid: {
				prev: (ast as any).right.value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "b"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "b")),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a ${prefix}()`, cursor: `a ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a ${variable}`, cursor: `a ${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a |&&", () => {
		const input = "a &&"
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).left.value.value,
			next: (ast as any).operator,
			valid: {
				prev: (ast as any).left.value.value,
				next: (ast as any).operator,
			},
			whitespace: {
				prev: true,
			},
			index,
		})

		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([])
	})

	it("a &|&", () => {
		const input = "a &&"
		const index = 3
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).left.value.value,
			at: (ast as any).operator,
			next: (ast as any).right,
			valid: {
				prev: (ast as any).left.value.value,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([])
	})

	it("a and|", () => {
		const input = "a and"
		const index = 5
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right,
			valid: {
				prev: (ast as any).operator,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, { start: index, end: index }, true, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, { start: index, end: index }, true),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a and ${prefix}()`, cursor: `a and ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a and ${variable}`, cursor: `a and ${variable}|`.lastIndexOf("|") })),
			])
	})
	it("a && |", () => {
		const input = "a && "
		const index = 5
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right,
			valid: {
				prev: (ast as any).operator,
			},
			whitespace: {
				next: false,
				prev: true,
			},
			index,
		})

		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, { start: index, end: index }, false, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, { start: index, end: index }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && ${prefix}()`, cursor: `a && ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a && ${variable}`, cursor: `a && ${variable}|`.lastIndexOf("|") })),
			])
	})

	it("a &&| b", () => {
		const input = "a && b"
		const index = 4
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.value.value,
			valid: {
				prev: (ast as any).operator,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				next: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([])
	})
	it("a &&| b", () => {
		const input = "a && b"
		const index = 4
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.value.value,
			valid: {
				prev: (ast as any).operator,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				next: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([])
	})

	it("a && |b", () => {
		const input = "a && b"
		const index = 5
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.value.value,
			valid: {
				prev: (ast as any).operator,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "b"), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, "b")),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && ${prefix}()`, cursor: `a && ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a && ${variable}`, cursor: `a && ${variable}|`.lastIndexOf("|") })),
			])
	})
})
describe("groups and related", () => {
	it("a && |b(c)", () => {
		const input = "a && b(c)"
		const index = 5
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.prefix.value.value,
			valid: {
				prev: (ast as any).operator,
				next: (ast as any).right.prefix.value.value,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "b")),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && ${prefix}(c)`, cursor: `a && ${prefix}|()`.lastIndexOf("|") })),
			])
	})
	it("a && b|(c)", () => {
		const input = "a && b(c)"
		const index = 6
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right.prefix.value.value,
			next: (ast as any).right.paren.left,
			valid: {
				prev: (ast as any).right.prefix.value.value,
				next: (ast as any).right.paren.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, "b")),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && ${prefix}(c)`, cursor: `a && ${prefix}|()`.lastIndexOf("|") })),
			])
	})
	it("a && b|(c) with groups disabled", () => {
		const input = "a && b(c)"
		const index = 6
		const opts = { prefixableGroups: false }
		const parser = new Parser(opts)
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right.left.value.value,
			next: (ast as any).right.operator,
			valid: {
				prev: (ast as any).right.left.value.value,
				next: (ast as any).right.right.paren.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_WORD_OP}`, { start: index, end: index }, true, false),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index - 1, end: index }, false, false), // next whitespace not needed if prefixableGroups off
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedSymbolOperators(suggestions[0]),
			...genExpectedWordOperators(suggestions[1]),
			...genExpectedVariables(suggestions[2]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...symOperators.map(op => ({ replacement: `a && b${op}(c)`, cursor: `a && b${op}|(c)`.lastIndexOf("|") })),
				...wordOperators.map(op => ({ replacement: `a && b ${op}(c)`, cursor: `a && b ${op}|(c)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a && ${variable}(c)`, cursor: `a && ${variable}|(c)`.lastIndexOf("|") })),
			])
	})
	it("a && b(|c)", () => {
		const input = "a && b(c)"
		const index = 7
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right.paren.left,
			next: (ast as any).right.expression.value.value,
			valid: {
				prev: (ast as any).right.paren.left,
				next: (ast as any).right.expression.value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, { start: index, end: index + 1 }, false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index, end: index + 1 }, false, false),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && b(${prefix}())`, cursor: `a && b(${prefix}(|))`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a && b(${variable})`, cursor: `a && b(${variable}|)`.lastIndexOf("|") })),
			])
	})
	it("a && b(c|)", () => {
		const input = "a && b(c)"
		const index = 8
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).right.expression.value.value,
			next: (ast as any).right.paren.right,
			valid: {
				prev: (ast as any).right.expression.value.value,
				next: (ast as any).right.paren.right,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PREFIX, { start: index - 1, end: index }, false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index - 1, end: index }, false, false),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedPrefixes(suggestions[0]),
			...genExpectedVariables(suggestions[1]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...prefixes.map(prefix => ({ replacement: `a && b(${prefix}())`, cursor: `a && b(${prefix}(|))`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a && b(${variable})`, cursor: `a && b(${variable}|)`.lastIndexOf("|") })),
			])
	})
})
describe("missing quotes or boolean operators", () => {
	it(`a |b"`, () => {
		const input = "a b\""
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).operator,
			next: (ast as any).right.value.quote.left,
			valid: {
				prev: (ast as any).left.value.value,
				next: (ast as any).right.value.value,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)


		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.DOUBLEQUOTE}`, { start: index, end: index }, false, false),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP}`, { start: index, end: index }, false, false),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_WORD_OP}`, { start: index, end: index }, false, true),
			suggest(SUGGESTION_TYPE.PREFIX, { start: index, end: index + 2 }, false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index, end: index + 2 }, false, false),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ suggestion: suggestions[0], value: "\"" },
			...genExpectedSymbolOperators(suggestions[1]),
			...genExpectedWordOperators(suggestions[2]),
			...genExpectedPrefixes(suggestions[3]),
			...genExpectedVariables(suggestions[4]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `a "b"`, cursor: `a "|b"`.indexOf("|") },
				...symOperators.map(op => ({ replacement: `a ${op}b"`, cursor: `a ${op}|b"`.lastIndexOf("|") })),
				...wordOperators.map(op => ({ replacement: `a ${op} b"`, cursor: `a ${op}| b"`.lastIndexOf("|") })),
				...prefixes.map(prefix => ({ replacement: `a ${prefix}()`, cursor: `a ${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `a ${variable}`, cursor: `a ${variable}|`.lastIndexOf("|") })),
			])
	})
	it(`"a"|b`, () => {
		const input = `"a"b`
		const index = 3
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).left.value.quote.right,
			next: (ast as any).operator,
			valid: {
				prev: (ast as any).left.value.quote.right,
				next: (ast as any).right.value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_SYMBOL_OP}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.BOOLEAN_WORD_OP}`, { start: index, end: index }, false, true),
			suggest(SUGGESTION_TYPE.PREFIX, findPos(input, `"a"`), false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, findPos(input, `"a"`), false, true),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedSymbolOperators(suggestions[0]),
			...genExpectedWordOperators(suggestions[1]),
			...genExpectedPrefixes(suggestions[2]),
			...genExpectedVariables(suggestions[3]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...symOperators.map(op => ({ replacement: `"a"${op}b`, cursor: `"a"${op}|b`.lastIndexOf("|") })),
				...wordOperators.map(op => ({ replacement: `"a"${op} b`, cursor: `"a"${op}| b`.lastIndexOf("|") })),
				...prefixes.map(prefix => ({ replacement: `${prefix}()b`, cursor: `${prefix}(|)b`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable} b`, cursor: `${variable}| b`.lastIndexOf("|") })),
			])
	})
})
describe("missing parens", () => {
	it(`(|`, () => {
		const input = `(`
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).paren.left,
			next: (ast as any).expression,
			valid: {
				prev: (ast as any).paren.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PARENR}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, { start: index, end: index }, false, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ suggestion: suggestions[0], value: ")" },
			...genExpectedPrefixes(suggestions[1]),
			...genExpectedVariables(suggestions[2]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `()`, cursor: `()|`.lastIndexOf("|") },
				...prefixes.map(prefix => ({ replacement: `(${prefix}()`, cursor: `(${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `(${variable}`, cursor: `(${variable}|`.lastIndexOf("|") })),
			])
	})
	it(`|)`, () => {
		const input = `)`
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			next: (ast as any).paren.left,
			valid: {
				next: (ast as any).paren.right,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PARENL}`, { start: index, end: index }),
			suggest(`ERROR.${SUGGESTION_TYPE.PREFIX}`, { start: index, end: index }, false, false, true),
			suggest(`ERROR.${SUGGESTION_TYPE.VARIABLE}`, { start: index, end: index }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ suggestion: suggestions[0], value: "(" },
			...genExpectedPrefixes(suggestions[1]),
			...genExpectedVariables(suggestions[2]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `()`, cursor: `(|)`.lastIndexOf("|") },
				...prefixes.map(prefix => ({ replacement: `${prefix}())`, cursor: `${prefix}(|))`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable})`, cursor: `${variable}|)`.lastIndexOf("|") })),
			])
	})
	it(`(a|`, () => {
		const input = `(a`
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)
		const expected = createCursor({
			prev: (ast as any).expression.value.value,
			next: (ast as any).paren.right,
			valid: {
				prev: (ast as any).expression.value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PARENR}`, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.PREFIX, { start: index - 1, end: index }, false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index - 1, end: index }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ suggestion: suggestions[0], value: ")" },
			...genExpectedPrefixes(suggestions[1]),
			...genExpectedVariables(suggestions[2]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `(a)`, cursor: `(a)|`.lastIndexOf("|") },
				...prefixes.map(prefix => ({ replacement: `(${prefix}()`, cursor: `(${prefix}(|)`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `(${variable}`, cursor: `(${variable}|`.lastIndexOf("|") })),
			])
	})
	it(`|a)`, () => {
		const input = `a)`
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			next: (ast as any).paren.left,
			valid: {
				next: (ast as any).expression.value.value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PARENL}`, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.PREFIX, { start: index, end: index + 1 }, false, false, true),
			suggest(SUGGESTION_TYPE.VARIABLE, { start: index, end: index + 1 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ suggestion: suggestions[0], value: "(" },
			...genExpectedPrefixes(suggestions[1]),
			...genExpectedVariables(suggestions[2]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `(a)`, cursor: `(|a)`.lastIndexOf("|") },
				...prefixes.map(prefix => ({ replacement: `${prefix}())`, cursor: `${prefix}(|))`.lastIndexOf("|") })),
				...variables.map(variable => ({ replacement: `${variable})`, cursor: `${variable}|)`.lastIndexOf("|") })),
			])
	})
})
describe("prefixed values", () => {
	it(`prefix|"a"`, () => {
		const input = `prefix"a"`
		const index = 6
		const parser = new Parser({ prefixableStrings: ["prefix"]})
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.prefix,
			next: (ast as any).value.quote.left,
			valid: {
				prev: (ast as any).value.prefix,
				next: (ast as any).value.quote.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.VARIABLE, { start: 0, end: input.length }, false, false, false, "prefix"),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedVariables(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...variables.map(variable => ({
					replacement: `prefix${variable.startsWith("\"") ? variable : `"${variable}"`}`,
					cursor: `prefix${variable.startsWith("\"") ? variable : `"${variable}"`}|`.lastIndexOf("|"),
				})),
			])
	})
})
describe("property conditions", () => {
	it(`prop|="a"`, () => {
		const input = `prop="a"`
		const index = 4
		const parser = new Parser({ customPropertyOperators: ["="]})
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).property.value,
			next: (ast as any).propertyOperator,
			valid: {
				prev: (ast as any).property.value,
				next: (ast as any).propertyOperator,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PROPERTY, { start: 0, end: 4 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedProps(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...properties.map(prop => ({
					replacement: `${prop}="a"`,
					cursor: `${prop}|="a"`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop=|"a"`, () => {
		const input = `prop="a"`
		const index = 5
		const parser = new Parser({ customPropertyOperators: ["="]})
		const ast = parser.parse(input)
		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).propertyOperator,
			next: (ast as any).value.quote.left,
			valid: {
				prev: (ast as any).propertyOperator,
				next: (ast as any).value.quote.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.CUSTOM_PROPERTY_OPERATOR, { start: 4, end: 5 }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedCustomOps(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...customPropertyOperators.map(op => ({
					replacement: `prop${op}"a"`,
					cursor: `prop${op}|"a"`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop="a|"|`, () => {
		// note, |"a" cannot suggest a value, only an operator
		const input = `prop="a"`
		const index = 5
		const parser = new Parser({ customPropertyOperators: ["="]})
		const ast = parser.parse(input)

		const suggestions = parser.autosuggest(input, ast, index + 2)
		const suggestions2 = parser.autosuggest(input, ast, index + 3)
		const expected = [
			suggest(SUGGESTION_TYPE.VALUE, { start: 5, end: 8 }),
		]
		expect(simplify(suggestions)).to.deep.equal(expected)
		expect(simplify(suggestions2)).to.deep.equal(expected)

		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedValues(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...values.map(val => ({
					replacement: `prop=${val}`,
					cursor: `prop=${val}|`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop|:OP:"a"`, () => {
		const input = `prop:OP:"a"`
		const index = 4
		const parser = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]})
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).property.value,
			next: (ast as any).sep.left,
			valid: {
				prev: (ast as any).property.value,
				next: (ast as any).sep.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.PROPERTY, { start: 0, end: 4 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedProps(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...properties.map(prop => ({
					replacement: `${prop}:OP:"a"`,
					cursor: `${prop}|:OP:"a"`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop:OP|:"a"`, () => {
		const input = `prop:OP:"a"`
		const index = 7
		const parser = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]})
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).propertyOperator,
			next: (ast as any).sep.right,
			valid: {
				prev: (ast as any).propertyOperator,
				next: (ast as any).sep.right,
			},
			index,
		})

		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.EXPANDED_PROPERTY_OPERATOR, { start: 5, end: 7 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedExpOps(suggestions[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...expandedPropertyOperators.map(op => ({
					replacement: `prop:${op}:"a"`,
					cursor: `prop:${op}|:"a"`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop:OP:|"|a"`, () => {
		const input = `prop:OP:"a"`
		const index = 8
		const parser = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]})
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).sep.right,
			next: (ast as any).value.quote.left,
			valid: {
				prev: (ast as any).sep.right,
				next: (ast as any).value.quote.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		const suggestions2 = parser.autosuggest(input, ast, index + 1)

		expect(simplify(suggestions)).to.deep.equal([
			// unlike custom operators we can suggest a value at this point since there is nothing else we can suggest
			suggest(SUGGESTION_TYPE.VALUE, { start: 8, end: 11 }),
		])
		expect(simplify(suggestions2)).to.deep.equal([
			suggest(SUGGESTION_TYPE.VALUE, { start: 8, end: 11 }),
		])

		const completions = parser.autocomplete(suggestions2, completionOpts)
		expect(completions).to.deep.equal([
			...genExpectedValues(suggestions2[0]),
		])

		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...values.map(val => ({
					replacement: `prop:OP:${val}`,
					cursor: `prop:OP:${val}|`.lastIndexOf("|"),
				})),
			])
	})
	it(`prop:OP|"a"`, () => {
		const input = `prop:OP"a"`
		const index = 7
		const parser = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]})
		const ast = parser.parse(input)


		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).propertyOperator,
			next: (ast as any).sep.right,
			valid: {
				prev: (ast as any).propertyOperator,
				next: (ast as any).value.quote.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.PROPERTY_SEP}`, { start: index, end: index }),
			suggest(SUGGESTION_TYPE.EXPANDED_PROPERTY_OPERATOR, { start: 5, end: 7 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)
		expect(completions).to.deep.equal([
			{ value: ":", suggestion: suggestions[0] },
			...genExpectedExpOps(suggestions[1]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: `prop:OP:"a"`, cursor: `prop:OP:|"a"`.lastIndexOf("|") },
				...expandedPropertyOperators.map(op => ({
					replacement: `prop:${op}"a"`,
					cursor: `prop:${op}|"a"`.lastIndexOf("|"),
				})),
			])
	})
})

describe("array values", () => {
	it(`|[array]`, () => {
		const input = `[array]`
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: undefined,
			next: (ast as any).value.bracket.left,
			valid: {
				prev: undefined,
				next: (ast as any).value.bracket.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
	})
	it(`[|array]`, () => {
		const input = `[array]`
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.bracket.left,
			next: (ast as any).value.values[0].value,
			valid: {
				prev: (ast as any).value.bracket.left,
				next: (ast as any).value.values[0].value,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.ARRAY_VALUE, { start: 1, end: 6 }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedArrayValues(suggestions[0]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...arrayValues.map(val => ({
					replacement: `[${val}]`,
					cursor: `[${val}|]`.lastIndexOf("|"),
				})),
			])
	})
	it(`[array ]`, () => {
		const input = `[array ]`
		const index = 7
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.values[0].value,
			next: (ast as any).value.bracket.right,
			valid: {
				prev: (ast as any).value.values[0].value,
				next: (ast as any).value.bracket.right,
			},
			whitespace: {
				prev: true,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.ARRAY_VALUE, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedArrayValues(suggestions[0]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...arrayValues.map(val => ({
					replacement: `[array ${val}]`,
					cursor: `[array ${val}|]`.lastIndexOf("|"),
				})),
			])
	})
	it(`[|`, () => {
		const input = `[`
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.bracket.left,
			next: (ast as any).value.bracket.right,
			valid: {
				prev: (ast as any).value.bracket.left,
				next: undefined,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.BRAKCETR}`, { start: 1, end: 1 }),
			suggest(SUGGESTION_TYPE.ARRAY_VALUE, { start: 1, end: 1 }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			{ value: "]", suggestion: suggestions[0] },
			...genExpectedArrayValues(suggestions[1]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: "[]", cursor: `[]|`.lastIndexOf("|") },
				...arrayValues.map(val => ({
					replacement: `[${val}`,
					cursor: `[${val}|`.lastIndexOf("|"),
				})),
			])
	})
})
describe("regex values", () => {
	it(`|//`, () => {
		const input = `//`
		const index = 0
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: undefined,
			next: (ast as any).value.quote.left,
			valid: {
				prev: undefined,
				next: (ast as any).value.quote.left,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
	})
	it(`/|/`, () => {
		const input = `//`
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.quote.left,
			next: (ast as any).value.value,
			valid: {
				prev: (ast as any).value.quote.left,
				next: (ast as any).value.quote.right,
			},
			index,
		})
		expect(info).to.deep.equal(expected)

		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([])
	})
	it(`/|`, () => {
		const input = `/`
		const index = 1
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.quote.left,
			next: (ast as any).value.value,
			valid: {
				prev: (ast as any).value.quote.left,
				next: undefined,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(`ERROR.${SUGGESTION_TYPE.REGEX}`, { start: index, end: index }),
		])
		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			{ value: "/", suggestion: suggestions[0] },
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				{ replacement: "//", cursor: `//|`.lastIndexOf("|") },
			])
	})
	it(`//|`, () => {
		const input = `//`
		const index = 2
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.quote.right,
			next: undefined,
			valid: {
				prev: (ast as any).value.quote.right,
				next: undefined,
			},
			index,
		})
		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.REGEX_FLAGS, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedRegexFlags(suggestions[0]),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...regexFlags.map(flag => ({
					replacement: `//${flag}`,
					cursor: `//${flag}|`.lastIndexOf("|"),
				})),
			])
	})
	it(`//i|`, () => {
		const input = `//i`
		const index = 3
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			prev: (ast as any).value.quote.flags,
			next: undefined,
			valid: {
				prev: (ast as any).value.quote.flags,
				next: undefined,
			},
			index,
		})

		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)
		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.REGEX_FLAGS, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)


		expect(completions).to.deep.equal([
			...genExpectedRegexFlags(suggestions[0]).filter(completion => completion.value !== "i"),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...regexFlags
					.filter(val => val !== "i")
					.map(flag => ({
						replacement: `//i${flag}`,
						cursor: `//i${flag}|`.lastIndexOf("|"),
					})),
			])
	})
	it(`//i|m`, () => {
		const input = `//im`
		const index = 3
		const parser = new Parser()
		const ast = parser.parse(input)

		const info = getCursorInfo(input, ast, index)

		const expected = createCursor({
			at: (ast as any).value.quote.flags,
			prev: (ast as any).value.quote.right,
			next: undefined,
			valid: {
				prev: (ast as any).value.quote.right,
				next: undefined,
			},
			index,
		})

		expect(info).to.deep.equal(expected)
		const suggestions = parser.autosuggest(input, ast, index)

		expect(simplify(suggestions)).to.deep.equal([
			suggest(SUGGESTION_TYPE.REGEX_FLAGS, { start: index, end: index }),
		])

		const completions = parser.autocomplete(suggestions, completionOpts)

		expect(completions).to.deep.equal([
			...genExpectedRegexFlags(suggestions[0])
				.filter(completion => !["i", "m"].includes(completion.value)),
		])
		expect(completions.map(completion => parser.autoreplace(input, completion)))
			.to.deep.equal([
				...regexFlags
					.filter(val => !["i", "m"].includes(val))
					.map(flag => ({
						replacement: `//i${flag}m`,
						cursor: `//i${flag}|m`.lastIndexOf("|"),
					})),
			])
	})
})
