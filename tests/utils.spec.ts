import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { e, t } from "./utils.js"

import { Parser } from "../src/parser.js"
import { extractTokens } from "../src/utils/extractTokens.js"


describe(testName({ __filename }), () => {
	describe("extractTokens", () => {
		it(`! || (b && "c`, () => {
			const input = `! || (b && "c`
			const ast = new Parser().parse(input)
			const expected = [
				t(input, "!"),
				e(input, "!", [""]),
				t(input, "||"),
				t(input, "("),
				t(input, "b"),
				t(input, "&&"),
				t(input, `"`),
				t(input, "c"),
				e(input, "c", [`"`]),
				e(input, "c", [`)`]),
			]
			expect(extractTokens(ast)).deep.equal(expected)
		})
		it(`a(b)`, () => {
			const input = `a(b)`
			const ast = new Parser().parse(input)
			const expected = [
				t(input, "a"),
				t(input, "("),
				t(input, "b"),
				t(input, ")"),
			]
			expect(extractTokens(ast)).deep.equal(expected)
		})
		it(`!(c)`, () => {
			const input = `!(c)`
			const ast = new Parser().parse(input)
			const expected = [
				t(input, `!`),
				t(input, "("),
				t(input, "c"),
				t(input, ")"),
			]
			expect(extractTokens(ast)).deep.equal(expected)
		})
		it(`()`, () => {
			const input = `()`
			const ast = new Parser().parse(input)
			const expected = [
				t(input, "("),
				e(input, "(", [""]),
				t(input, ")"),
			]
			expect(extractTokens(ast)).deep.equal(expected)
		})
		it(`&& a ||`, () => {
			const input = `&& a ||`
			const ast = new Parser().parse(input)
			const expected = [
				e(input, "", [""]),
				t(input, "&&"),
				t(input, "a"),
				t(input, "||"),
				e(input, "||", [""]),
			]
			expect(extractTokens(ast)).deep.equal(expected)
		})
	})
})
