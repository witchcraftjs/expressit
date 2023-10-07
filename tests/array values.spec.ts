import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { findPos, t, v } from "./utils.js"

import { array, condition, delim, variable } from "../src/ast/builders/index.js"
import { Parser } from "../src/parser.js"
import { TOKEN_TYPE } from "../src/types/ast.js"


// more related tests are in ./property operators
describe(testName({ __filename }), () => {
	it(`[]`, () => {
		const input = `[]`
		const ast = new Parser().parse(input)

		const expected = condition(
			array(
				[],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[] - disabled`, () => {
		const input = `[]`
		const ast = new Parser({
			arrayValues: false,
		}).parse(input)

		const expected = condition(
			v(input, "[]")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[] - disabled by function`, () => {
		const input = `[]`
		const ast = new Parser({
			arrayValues: () => false,
		}).parse(input)


		const expected = condition(
			v(input, "[]")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[] - enabled by function`, () => {
		const input = `[]`
		const ast = new Parser({
			arrayValues: () => true,
		}).parse(input)

		const expected = condition(
			array(
				[],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[] - disabled alone`, () => {
		const input = `[]`
		const ast = new Parser({
			arrayValues: prop => prop !== undefined,
		}).parse(input)

		const expected = condition(
			v(input, "[]")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`prop:[]`, () => {
		const input = `prop:[]`
		const ast = new Parser({ customPropertyOperators: [":"]}).parse(input)

		const expected = condition(
			array(
				[],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			),
			true,
			v(input, "prop"),
			t(input, ":", TOKEN_TYPE.OP_CUSTOM)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[&&]`, () => {
		const input = `[&&]`
		const ast = new Parser().parse(input)

		const expected = condition(
			array(
				[v(input, "&&")],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[[]`, () => {
		const input = `[[]`
		const ast = new Parser().parse(input)

		const expected = condition(
			array(
				[variable(undefined, "[", undefined, { start: input.lastIndexOf("["), end: input.lastIndexOf("[") + 1 })],
				delim(true, true),
				findPos(input, "["),
				{ start: input.lastIndexOf("]"), end: input.lastIndexOf("]") + 1 }
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[//]`, () => {
		const input = `[//]`
		const ast = new Parser().parse(input)

		const expected = condition(
			array(
				[v(input, "//")],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[prefix"val"]`, () => {
		const input = `[prefix"val"]`
		const ast = new Parser({ prefixableStrings: ["prefix"]}).parse(input)

		const expected = condition(
			array(
				[v(input, "val", delim("\"", "\""), t(input, "prefix"))],
				delim(true, true),
				findPos(input, "["),
				findPos(input, "]")
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`[`, () => {
		const input = `[`
		const ast = new Parser().parse(input)

		const expected = condition(
			array(
				[],
				delim(true, false),
				findPos(input, "["),
			)
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`] - cannot match missing left brackets, will parse as value`, () => {
		const input = `]`
		const ast = new Parser().parse(input)


		const expected = condition(
			v(input, "]")
		)
		expect(ast).to.deep.equal(expected)
	})
})
