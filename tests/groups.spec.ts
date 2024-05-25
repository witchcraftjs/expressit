import { describe, expect, it } from "vitest"

import { e, t, v } from "./utils.js"

import { condition, delim, expression, group } from "../src/ast/builders/index.js"
import { Parser } from "../src/Parser.js"


const parser = new Parser()
const parserNoGroups = new Parser({ prefixableGroups: false })

describe("always enabled grouping (for precedence or negation)", () => {
	it(`(a)`, () => {
		const input = "(a)"
		const expected =
				group(
					undefined,
					condition(
						v(input, "a"),
					),
					delim(true, true),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(((a)))`, () => {
		const input = "(((a)))"
		const expected =
				group(undefined,
					group(undefined,
						group(undefined,
							condition(
								v(input, "a"),
							),
						),
					),
				)
		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(a && b)`, () => {
		const input = "(a && b)"
		const expected =
				group(
					undefined,
					expression(
						condition(
							v(input, "a"),
						),
						t(input, "&&"),
						condition(
							v(input, "b"),
						),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`a && (b || c)`, () => {
		const input = `a && (b || c)`
		const expected =
				expression(
					condition(
						v(input, "a"),
					),
					t(input, "&&"),
					group(undefined,
						expression(
							condition(
								v(input, "b"),
							),
							t(input, "||"),
							condition(
								v(input, "c"),
							),
						),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(a && b) || c`, () => {
		const input = "(a && b) || c"
		const expected =
			expression(
				group(undefined,
					expression(
						condition(
							v(input, "a"),
						),
						t(input, "&&"),
						condition(
							v(input, "b"),
						),
					),
				),
				t(input, "||"),
				condition(
					v(input, "c"),
				),
			)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(a || b) && c`, () => {
		const input = "(a || b) && c"
		const expected =
				expression(
					group(undefined,
						expression(
							condition(
								v(input, "a"),
							),
							t(input, "||"),
							condition(
								v(input, "b"),
							),
						),
					),
					t(input, "&&"),
					condition(
						v(input, "c"),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`a || (b && c)`, () => {
		const input = "a || (b && c)"
		const expected =
				expression(
					condition(
						v(input, "a"),
					),
					t(input, "||"),
					group(undefined,
						expression(
							condition(
								v(input, "b"),
							),
							t(input, "&&"),
							condition(
								v(input, "c"),
							),
						),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(a || b && c)`, () => {
		const input = "(a || b && c)"
		const expected =
				group(undefined,
					expression(
						condition(
							v(input, "a"),
						),
						t(input, "||"),
						expression(
							condition(
								v(input, "b"),
							),
							t(input, "&&"),
							condition(
								v(input, "c"),
							),
						),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
		const parsedNoGroups = parserNoGroups.parse(input)
		expect(parsedNoGroups).to.deep.equal(expected)
	})
	it(`(a) || (b)`, () => {
		const input = "(a) || (b)"
		const expected =
				expression(
					group(
						undefined,
						condition(
							v(input, "a"),
						),
					),
					t(input, "||"),
					group(
						undefined,
						condition(
							v(input, "b"),
						),
					),
				)

		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
	})
	describe("errors", () => {
		it(`(a`, () => {
			const input = "(a"
			const expected =
					group(
						undefined,
						condition(
							v(input, "a"),
						),
						delim(true, false),
					)

			const parsed = parser.parse(input)
			expect(parsed).to.deep.equal(expected)
			const parsedNoGroups = parserNoGroups.parse(input)
			expect(parsedNoGroups).to.deep.equal(expected)
		})
		it(`a)`, () => {
			const input = "a)"
			const expected =
					group(
						undefined,
						condition(
							v(input, "a"),
						),
						delim(false, true),
					)

			const parsed = parser.parse(input)
			const ast = parsed

			expect(ast).to.deep.equal(expected)
		})
		it("(a ||) b", () => {
			const input = "(a ||) b"

			const parsed = parser.parse(input)
			const ast = parsed
			const expected =
					expression(
						group(
							undefined,
							expression(
								condition(
									v(input, "a"),
								),
								t(input, "||"),
								e(input, "||", [""]),
							),
						),
						e(input, ")", ["&&", "||"]),
						condition(
							v(input, "b"),
						),
					)

			expect(ast).to.deep.equal(expected, undefined)
		})
		it("a ||) b)", () => {
			const input = "a ||) b)"
			const expected =
					group(
						undefined,
						expression(
							group(
								undefined,
								expression(
									condition(
										v(input, "a"),
									),
									t(input, "||"),
									e(input, "||", [""]),
								),
								delim(false, true),
							),
							e(input, ")", ["&&", "||"]),
							condition(
								v(input, "b"),
							),
						),
						delim(false, true),
					)

			const parsed = parser.parse(input)
			expect(parsed).to.deep.equal(expected)
		})
		it("a)(((b", () => {
			const input = "a)(((b"
			const expected =
						expression(
							group(
								undefined,
								condition(
									v(input, "a"),
								),
								delim(false, true),
							),
							e(input, ")", ["&&", "||"]),
							group(undefined,
								group(undefined,
									group(undefined,
										condition(
											v(input, "b"),
										),
										delim(true, false),
									),
									delim(true, false),
								),
								delim(true, false),
							),
						)

			const parsed = parser.parse(input)
			expect(parsed).to.deep.equal(expected)
		})
		it(`a")(((b"`, () => {
			const input = `a")(((b"`
			const expected =
						expression(
							group(
								undefined,
								condition(
									v(input, "a", delim(false, "\"")),
								),
								delim(false, true),
							),
							e(input, ")", ["&&", "||"]),
							group(undefined,
								group(undefined,
									group(undefined,
										condition(
											v(input, "b", delim(false, "\"")),
										),
										delim(true, false),
									),
									delim(true, false),
								),
								delim(true, false),
							),
						)

			const parsed = parser.parse(input)
			expect(parsed).to.deep.equal(expected)
		})
	})
})
describe("prefixiableGroups", () => {
	it(`prefix(condition)1`, () => {
		const input = "prefix(condition)"
		const expected =
				group(
					condition(
						v(input, "prefix"),
					),
					condition(
						v(input, "condition"),
					),
				)
		const parsed = parser.parse(input)
		expect(parsed).to.deep.equal(expected)
	})
	describe("disabled - errors", () => {
		it(`prefix(condition)2`, () => {
			const input = "prefix(condition)"
			const expected =
				expression(
					condition(
						v(input, "prefix"),
					),
					e(input, "prefix", ["&&", "||"]),
					group(
						undefined,
						condition(
							v(input, "condition"),
						),
					),
				)
			const parsedNoGroups = parserNoGroups.parse(input)
			expect(parsedNoGroups).to.deep.equal(expected)
		})
		it(`"prefix()"`, () => {
			const input = "prefix()"
			const expected =
				expression(
					condition(
						v(input, "prefix"),
					),
					e(input, "prefix", ["&&", "||"]),
					group(
						undefined,
						e(input, "(", [""]),
					),
				)
			const parsedNoGroups = parserNoGroups.parse(input)
			expect(parsedNoGroups).to.deep.equal(expected)
		})
		it(`"prefix("`, () => {
			const input = "prefix("
			const expected =
				expression(
					condition(
						v(input, "prefix"),
					),
					e(input, "prefix", ["&&", "||"]),
					group(
						undefined,
						e(input, "(", [""]),
						delim(true, false),
					),
				)
			const parsedNoGroups = parserNoGroups.parse(input)
			expect(parsedNoGroups).to.deep.equal(expected)
		})
	})
})
