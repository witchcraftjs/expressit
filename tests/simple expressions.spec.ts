import { testName } from "@utils/testing"

import { expect } from "./chai"
import { checkVariables, e, t, unquoted, v } from "./utils"

import { condition, delim, expression, pos, token } from "@/ast/builders"
import { Parser } from "@/index"
import { TOKEN_TYPE } from "@/types"


describe(testName({ __filename }), () => {
	describe("no expression", () => {
		it(" ", () => {
			const input = " "
			const ast = new Parser().parse(input)
			expect(ast).to.deep.equal(e(input, "", [""]))
		})
		it("    ", () => {
			const input = "    "
			const ast = new Parser().parse(input)
			expect(ast).to.deep.equal(e(input, "", [""]))
		})
	})
	it("variables", () => {
		checkVariables([
			"a", "andromeda", "oregano", "moor", "bland",
		], val => [undefined, val, unquoted, pos(0, val.length)])
	})
	it(`a""b`, () => {
		const input = "a\"\"b"
		const ast = new Parser().parse(input)
		const expected = expression(
			condition(
				v(input, "a", delim(false, "\""))
			),
			e(input, "a\"", ["&&", "||"]),
			condition(
				v(input, "b", delim("\"", false))
			),
		)
		expect(ast).deep.equal(expected)
	})
	it(`a || b`, () => {
		const input = "a || b"
		const ast = new Parser().parse(input)
		const expected = expression(
			condition(
				v(input, "a")
			),
			t(input, "||"),
			condition(
				v(input, "b")
			),
		)
		expect(ast).deep.equal(expected)
	})
	it(`a||b`, () => {
		const input = "a||b"
		const ast = new Parser().parse(input)
		const expected = expression(
			condition(
				v(input, "a")
			),
			t(input, "||"),
			condition(
				v(input, "b")
			),
		)

		expect(ast).deep.equal(expected)
	})
	it(`a && b`, () => {
		const input = "a && b"
		const ast = new Parser().parse(input)
		const expected = expression(
			condition(
				v(input, "a")
			),
			t(input, "&&"),
			condition(
				v(input, "b")
			),
		)
		expect(ast).deep.equal(expected)
	})
	it(`a && b || c`, () => {
		const input = "a && b || c"
		const ast = new Parser().parse(input)
		const expected =
			expression(
				expression(
					condition(
						v(input, "a")
					),
					t(input, "&&"),
					condition(
						v(input, "b")
					),
				),
				t(input, "||"),
				condition(
					v(input, "c")
				),
			)
		expect(ast).deep.equal(expected)
	})
	it(`a || b && c`, () => {
		const input = "a || b && c"
		const ast = new Parser().parse(input)
		const expected =
			expression(
				condition(
					v(input, "a")
				),
				t(input, "||"),
				expression(
					condition(
						v(input, "b")
					),
					t(input, "&&"),
					condition(
						v(input, "c")
					),
				),
			)
		expect(ast).deep.equal(expected)
	})
	it(`a ||`, () => {
		const input = "a ||"
		const ast = new Parser().parse(input)
		const expected =
			expression(
				condition(
					v(input, "a")
				),
				t(input, "||"),
				e(input, "||", [""]),
			)
		expect(ast).deep.equal(expected)
	})
	it(`a &&`, () => {
		const input = "a &&"
		const ast = new Parser().parse(input)
		const expected =
			expression(
				condition(
					v(input, "a")
				),
				t(input, "&&"),
				e(input, "&&", [""]),
			)

		expect(ast).deep.equal(expected)
	})
	it(`a b`, () => {
		const input = "a b"
		const ast = new Parser().parse(input)

		const expected =
			expression(
				condition(
					v(input, "a")
				),
				e(input, "a", ["&&", "||"]),
				condition(
					v(input, "b")
				),
			)

		expect(ast).deep.equal(expected)
	})
	describe("onMissingBooleanOperator", () => {
		it(`a b - onMissingBooleanOperator = and`, () => {
			const input = "a b"
			const ast = new Parser({ onMissingBooleanOperator: "and" }).parse(input)

			const expected =
			expression(
				condition(
					v(input, "a")
				),
				token(TOKEN_TYPE.AND, "", { start: input.indexOf(" "), end: input.indexOf(" ") }),
				condition(
					v(input, "b")
				),
			)

			expect(ast).deep.equal(expected)
		})
		it(`a b - onMissingBooleanOperator = or`, () => {
			const input = "a b"
			const ast = new Parser({ onMissingBooleanOperator: "or" }).parse(input)

			const expected =
			expression(
				condition(
					v(input, "a")
				),
				token(TOKEN_TYPE.OR, "", { start: input.indexOf(" "), end: input.indexOf(" ") }),
				condition(
					v(input, "b")
				),
			)

			expect(ast).deep.equal(expected)
		})
		it(`a && b c - onMissingBooleanOperator = and`, () => {
			const input = "a && b c"
			const ast = new Parser(({ onMissingBooleanOperator: "and" })).parse(input)

			const expected =
			expression(
				condition(
					v(input, "a")
				),
				t(input, "&&"),
				expression(
					condition(
						v(input, "b")
					),
					token(TOKEN_TYPE.AND, "", { start: input.indexOf(" c"), end: input.indexOf(" c") }),
					condition(
						v(input, "c")
					),
				),
			)
			expect(ast).deep.equal(expected)
		})
		it(`a && b c - onMissingBooleanOperator = or`, () => {
			const input = "a && b c"
			const ast = new Parser(({ onMissingBooleanOperator: "or" })).parse(input)

			const expected =
			expression(
				expression(
					condition(
						v(input, "a")
					),
					t(input, "&&"),
					condition(
						v(input, "b")
					),
				),
				token(TOKEN_TYPE.OR, "", { start: input.indexOf(" c"), end: input.indexOf(" c") }),
				condition(
					v(input, "c")
				),
			)
			expect(ast).deep.equal(expected)
		})
	})
})
