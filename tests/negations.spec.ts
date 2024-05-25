import { describe, expect, it } from "vitest"

import { e, t, v } from "./utils.js"

import { condition, expression, group } from "../src/ast/builders/index.js"
import { Parser } from "../src/Parser.js"


it(`!`, () => {
	const input = `!`
	const expected =
			condition(
				e(input, "!", [""]),
				t(input, "!"),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`not a`, () => {
	const input = `not a`
	const expected =
			condition(
				v(input, "a"),
				t(input, "not"),
			)

	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`! a`, () => {
	const input = `! a`
	const expected =
			condition(
				v(input, "a"),
				t(input, "!"),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`!a`, () => {
	const input = `!a`
	const expected =
			condition(
				v(input, "a"),
				t(input, "!"),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`nota`, () => {
	const input = `nota`
	const expected =
			condition(
				v(input, "nota"),
				true,
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`!(a)`, () => {
	const input = `!(a)`
	const expected =
			group(
				t(input, "!"),
				condition(
					v(input, "a"),
					true,
				),
			)

	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`not(a)`, () => {
	const input = `not(a)`
	const expected =
			group(
				t(input, "not"),
				condition(
					v(input, "a"),
					true,
				),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`not (a)`, () => {
	const input = `not (a)`
	const expected =
			group(
				t(input, "not"),
				condition(
					v(input, "a"),
					true,
				),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`not((a))`, () => {
	const input = `not((a))`
	const ast = new Parser({ prefixableGroups: false }).parse(input)
	const expected =
			group(
				t(input, "not"),
				group(
					undefined,
					condition(
						v(input, "a"),
						true,
					),
				),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`not(a || b)`, () => {
	const input = `not(a || b)`
	const expected =
			group(
				t(input, "not"),
				expression(
					condition(
						v(input, "a"),
					),
					t(input, "||"),
					condition(
						v(input, "b"),
					),
				),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
it(`! (a || b)`, () => {
	const input = `! (a || b)`
	const expected =
			group(
				t(input, "!"),
				expression(
					condition(
						v(input, "a"),
					),
					t(input, "||"),
					condition(
						v(input, "b"),
					),
				),
			)
	expect(new Parser().parse(input)).to.deep.equal(expected)
	expect(new Parser({ prefixableGroups: false }).parse(input)).to.deep.equal(expected)
})
