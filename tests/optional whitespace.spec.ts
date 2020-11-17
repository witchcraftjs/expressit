import { testName } from "@utils/testing"

import { expect } from "./chai"
import { double, t, v } from "./utils"

import { condition, delim, expression, group, pos } from "@/ast/builders"
import { Parser } from "@/index"


describe(testName({ __filename }), () => {
	it(" a ", () => {
		const input = " a "
		const ast = new Parser().parse(input)
		const expected =
				condition(
					v(input, "a")
				)
		expect(ast).to.deep.equal(expected)
	})
	it("a             ||             b", () => {
		const input = "a             ||             b"
		const ast = new Parser().parse(input)
		const expected =
				expression(
					condition(
						v(input, "a")
					),
					t(input, "||"),
					condition(
						v(input, "b")
					),
				)
		expect(ast).to.deep.equal(expected)
	})
	it("( a )", () => {
		const input = "( a )"
		const ast = new Parser().parse(input)
		const expected =
				group(undefined,
					condition(
						v(input, "a")
					),
					undefined,
					pos(0, 1),
					pos(4, 5)
				)
		expect(ast).to.deep.equal(expected)
	})
	it(`( "a" )`, () => {
		const input = `( "a" )`
		const ast = new Parser().parse(input)
		const expected =
						group(undefined,
							condition(
								v(input, "a", delim(double, double))
							),
							undefined,
							pos(0, 1),
							pos(6, 7)
						)
		expect(ast).to.deep.equal(expected)
	})
	it(`( " a " )`, () => {
		const input = `( " a " )`
		const ast = new Parser().parse(input)
		const expected =
				group(undefined,
					condition(
						v(input, " a ", delim(double, double))
					),
					undefined,
					pos(0, 1),
					pos(8, 9)
				)

		expect(ast).to.deep.equal(expected)
	})
	it(`(" a ")`, () => {
		const input = `(" a ")`
		const ast = new Parser().parse(input)
		const expected =
				group(undefined,
					condition(
						v(input, " a ", delim(double, double))
					),
					undefined,
				)
		expect(ast).to.deep.equal(expected)
	})
})
