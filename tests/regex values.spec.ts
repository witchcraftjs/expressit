import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { e, v } from "./utils.js"

import { condition, delim, variable } from "../src/ast/builders/index.js"
import { Parser } from "../src/parser.js"

// more related tests are in ./property operators
describe(testName({ __filename }), () => {
	it(`//`, () => {
		const input = `//`
		const ast = new Parser().parse(input)
		const expected = condition(
			variable(undefined, e(input, "/", [""]), delim("/", "/"))
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`// - disabled`, () => {
		const input = `//`
		const ast = new Parser({
			regexValues: false,
		}).parse(input)

		const expected = condition(
			v(input, "//")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`// - disabled alone`, () => {
		const input = `//`
		const ast = new Parser({
			regexValues: prop => prop !== undefined,
		}).parse(input)

		const expected = condition(
			v(input, "//")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`//flags`, () => {
		const input = `//flags`
		const ast = new Parser().parse(input)
		const expected = condition(
			variable(undefined, e(input, "/", [""]), { ...delim("/", "/"), flags: "flags" })
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`/[/`, () => {
		const input = `/[/`
		const ast = new Parser().parse(input)
		const expected = condition(
			v(input, "[/", delim("/", false))
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`/]a[/]\\//`, () => {
		const input = `/]a[/]\\//`
		const ast = new Parser().parse(input)
		const expected = condition(
			v(input, "]a[/]\\/", delim("/", "/"))
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`/\\/`, () => {
		const input = `/\\/`
		const ast = new Parser().parse(input)
		const expected = condition(
			v(input, "\\/", delim("/", false))
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`\\/\\/`, () => {
		const input = `\\/\\/`
		const ast = new Parser().parse(input)
		const expected = condition(
			v(input, "\\/\\/")
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`/bla/`, () => {
		const input = `/bla/`
		const ast = new Parser({ regexValues: false }).parse(input)
		const expected = condition(
			v(input, "/bla/")
		)
		expect(ast).to.deep.equal(expected)
	})
})
