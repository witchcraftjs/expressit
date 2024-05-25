import { performance } from "perf_hooks"
import { describe, expect, it } from "vitest"

import { e, findPos, t, v } from "./utils.js"

import { array, condition, delim, group, token, variable } from "../src/ast/builders/index.js"
import { Parser } from "../src/Parser.js"
import { TOKEN_TYPE } from "../src/types/ast.js"
import { prettyAst } from "../src/utils/prettyAst.js"
/**
 * Note: If prop and op are used in the test inputings, the helper functions will "incorrectly" find the op in prop instead of op, so that's why OP is used instead
 */

describe(`expandedPropertySeparator and customPropertyOperators containing separator`, () => {
	it(`prop:"a"`, () => {
		const input = `prop:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, ":", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`!prop:"a"`, () => {
		const input = `!prop:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			v(input, "prop"),
			t(input, ":", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`:"a"`, () => {
		const input = `:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, ":", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`!:"a"`, () => {
		const input = `!:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			e(input, "!", [TOKEN_TYPE.VALUE]),
			t(input, ":", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`prop:OP:"a"`, () => {
		const input = `prop:OP:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, "OP"),
			{
				left: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 4, end: 5 }),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 7, end: 8 }),
			},
		)
		expect(ast).to.deep.equal(expected, prettyAst(ast))
	})
	it(`!prop:OP:"a"`, () => {
		const input = `!prop:OP:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			v(input, "prop"),
			t(input, "OP"),
			{
				left: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 5, end: 6 }),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 8, end: 9 }),
			},
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`:op:"a"`, () => {
		const input = `:op:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "op"),
			{
				left: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 0, end: 1 }),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 3, end: 4 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`!:op:"a"`, () => {
		const input = `!:op:"a"`
		const ast = new Parser({ expandedPropertySeparator: ":", customPropertyOperators: [":"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			e(input, "!", [TOKEN_TYPE.VALUE]),
			t(input, "op"),
			{
				left: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 1, end: 2 }),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 4, end: 5 }),
			},
		)
		expect(ast).to.deep.equal(expected)
	})
})
describe("customPropertyOperators - one character", () => {
	it(`prop="a"`, () => {
		const input = `prop="a"`
		const ast = new Parser({ customPropertyOperators: ["="]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, "=", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`!prop="a"`, () => {
		const input = `!prop="a"`
		const ast = new Parser({ customPropertyOperators: ["="]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			v(input, "prop"),
			t(input, "=", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`="a"`, () => {
		const input = `="a"`
		const ast = new Parser({ customPropertyOperators: ["="]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "=", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`!="a"`, () => {
		const input = `!="a"`
		const ast = new Parser({ customPropertyOperators: ["="]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			e(input, "!", [TOKEN_TYPE.VALUE]),
			t(input, "=", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`prop!"a"`, () => {
		const input = `prop!"a"`
		const ast = new Parser({ customPropertyOperators: ["!"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, "!", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`prop!="a"`, () => {
		const input = `prop!="a"`
		const ast = new Parser({ customPropertyOperators: ["!="]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, "!=", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
})
describe(`customPropertyOperators - two and "conflicting" on character`, () => {
	it(`prop<>"a"`, () => {
		const input = `prop<>"a"`
		const ast = new Parser({ customPropertyOperators: ["<>", "<"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			v(input, "prop"),
			t(input, "<>", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`!prop<>"a"`, () => {
		const input = `!prop<>"a"`
		const ast = new Parser({ customPropertyOperators: ["<>", "<"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			v(input, "prop"),
			t(input, "<>", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`<>"a"`, () => {
		const input = `<>"a"`
		const ast = new Parser({ customPropertyOperators: ["<>", "<"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "<>", TOKEN_TYPE.OP_CUSTOM),
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`!<>"a"`, () => {
		const input = `!<>"a"`
		const ast = new Parser({ customPropertyOperators: ["<>", "<"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			t(input, "!"),
			e(input, "!", [TOKEN_TYPE.VALUE]),
			t(input, "<>", TOKEN_TYPE.OP_CUSTOM),
		)
		expect(ast).to.deep.equal(expected)
	})
})
describe("customPropertyOperators using !", () => {
	it(`!prop!"a"`, () => {
		const input = `!prop!"a"`
		const ast = new Parser({ customPropertyOperators: ["!"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			token(TOKEN_TYPE.NOT, "!", { start: 0, end: 1 }),
			v(input, "prop"),
			token(TOKEN_TYPE.OP_CUSTOM, "!", { start: 5, end: 6 }),
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`!!"a"`, () => {
		const input = `!!"a"`
		const ast = new Parser({ customPropertyOperators: ["!"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\"")),
			token(TOKEN_TYPE.NOT, "!", { start: 0, end: 1 }),
			e(input, "!", [TOKEN_TYPE.VALUE]),
			token(TOKEN_TYPE.OP_CUSTOM, "!", { start: 1, end: 2 }),
		)
		expect(ast).to.deep.equal(expected)
	})
})
describe(`expandedPropertySeparator only`, () => {
	it(`:`, () => {
		const input = `:`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, ":", [TOKEN_TYPE.VALUE]),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				// right: undefined, // right is undefined because we don' know if we need another separator or not
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`::`, () => {
		const input = `::`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "::", [TOKEN_TYPE.VALUE]),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 1, end: 2 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`prop:`, () => {
		const input = `prop:`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, ":", [TOKEN_TYPE.VALUE]),
			true,
			v(input, "prop"),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
			},
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`:op`, () => {
		const input = `:op`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "op", [TOKEN_TYPE.VALUE]),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "op"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`prop:OP`, () => {
		const input = `prop:OP`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "OP", [TOKEN_TYPE.VALUE]),
			true,
			v(input, "prop"),
			t(input, "OP"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`:op:var`, () => {
		const input = `:op:var`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			v(input, "var"),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "op"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 3, end: 4 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`prop:OP:`, () => {
		const input = `prop:OP:`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "OP:", [TOKEN_TYPE.VALUE]),
			true,
			v(input, "prop"),
			t(input, "OP"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 7, end: 8 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`:op:`, () => {
		const input = `:op:`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "op:", [TOKEN_TYPE.VALUE]),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			t(input, "op"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 3, end: 4 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`prop::`, () => {
		const input = `prop::`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			e(input, "::", [TOKEN_TYPE.VALUE]),
			true,
			v(input, "prop"),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 5, end: 6 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`::var`, () => {
		const input = `::var`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			v(input, "var"),
			true,
			e(input, "", [TOKEN_TYPE.OP_EXPANDED_SEP]),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 1, end: 2 }),
			},
		)

		expect(ast).to.deep.equal(expected)
	})
})
describe(`expandedPropertySeparator only - with groups`, () => {
	it(`:()`, () => {
		const input = `:()`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			group(undefined, e(input, "(", [TOKEN_TYPE.VALUE])),
			true,
			e(input, "", [TOKEN_TYPE.VALUE]),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: undefined,
			},
		)

		expect(ast).to.deep.equal(expected)
	})
	it(`prop:()`, () => {
		const input = `prop:()`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			group(undefined, e(input, "(", [TOKEN_TYPE.VALUE])),
			true,
			v(input, "prop"),
			e(input, ":", [TOKEN_TYPE.VALUE]),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: undefined,
			},
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`prop:OP()`, () => {
		const input = `prop:OP()`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			group(undefined, e(input, "(", [TOKEN_TYPE.VALUE])),
			true,
			v(input, "prop"),
			t(input, "OP"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: undefined,
			},
		)
		expect(ast).to.deep.equal(expected)
	})
	it(`:op()`, () => {
		const input = `:op()`
		const ast = new Parser({ expandedPropertySeparator: ":" }).parse(input)
		const expected = condition(
			group(undefined, e(input, "(", [TOKEN_TYPE.VALUE])),
			true,
			e(input, "", [TOKEN_TYPE.OP_EXPANDED_SEP]),
			t(input, "op"),
			{
				left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
				right: undefined,
			},
		)
		expect(ast).to.deep.equal(expected)
	})
	describe("other value types", () => {
		describe("customPropertyOperators", () => {
			it(`prop:[]`, () => {
				const input = `prop:[]`
				const ast = new Parser({ customPropertyOperators: [":"], arrayValues: true }).parse(input)

				const expected = condition(
					array([], delim(true, true), findPos(input, "["), findPos(input, "]")),
					true,
					v(input, "prop"),
					t(input, ":", TOKEN_TYPE.OP_CUSTOM),
				)
				expect(ast).to.deep.equal(expected)
			})
			it(`prop://`, () => {
				const input = `prop://`
				const ast = new Parser({ customPropertyOperators: [":"], arrayValues: true }).parse(input)
				const expected = condition(
					variable(undefined, e(input, "/", [""]), delim("/", "/")),
					true,
					v(input, "prop"),
					t(input, ":", TOKEN_TYPE.OP_CUSTOM),
				)
				expect(ast).to.deep.equal(expected)
			})
			it(`prop://`, () => {
				const input = `prop://`
				const ast = new Parser({ customPropertyOperators: [":"], arrayValues: true, regexValues: () => false }).parse(input)
				const expected = condition(
					v(input, "//"),
					true,
					v(input, "prop"),
					t(input, ":", TOKEN_TYPE.OP_CUSTOM),
				)
				expect(ast).to.deep.equal(expected)
			})
			it(`prop:[]`, () => {
				const input = `prop:[]`
				const ast = new Parser({ customPropertyOperators: [":"], arrayValues: () => false }).parse(input)
				const expected = condition(
					v(input, "[]"),
					true,
					v(input, "prop"),
					t(input, ":", TOKEN_TYPE.OP_CUSTOM),
				)
				expect(ast).to.deep.equal(expected)
			})
		})
		describe("expandedPropertySeparator", () => {
			it(`prop:OP:[]`, () => {
				const input = `prop:OP:[]`
				const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)
				const expected = condition(
					array([], delim(true, true), findPos(input, "["), findPos(input, "]")),
					true,
					v(input, "prop"),
					t(input, "OP"),
					{
						left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
						right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 7, end: 8 }),
					},
				)
				expect(ast).to.deep.equal(expected)
			})
			it(`prop:OP://`, () => {
				const input = `prop:OP://`
				const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)
				const expected = condition(
					variable(undefined, e(input, "/", [""]), delim("/", "/")),
					true,
					v(input, "prop"),
					t(input, "OP"),
					{
						left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
						right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 7, end: 8 }),
					},
				)
				expect(ast).to.deep.equal(expected)
			})
			it(`prop:OP:// (regex operator values off)`, () => {
				const input = `prop:OP://`
				const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true, regexValues: () => false }).parse(input)
				const expected = condition(
					v(input, "//"),
					true,
					v(input, "prop"),
					t(input, "OP"),
					{
						left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
						right: token(TOKEN_TYPE.OP_EXPANDED_SEP, ":", { start: 7, end: 8 }),
					},
				)
				expect(ast).to.deep.equal(expected)
			})

			describe("group values", () => {
				it(`prop:OP(notPROP:op:actually-value)`, () => {
					const input = `prop:OP(notPROP:op:actually-value)`
					const start = performance.now()
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)
					const end = performance.now()

					const expected = condition(
						group(undefined, condition(v(input, "notPROP:op:actually-value"))),
						true,
						v(input, "prop"),
						t(input, "OP"),
						{
							left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
							right: undefined,
						},
					)
					expect(ast).to.deep.equal(expected)
				})
				it(`performance of multiple group values for operators (which uses a subparser for each group) is okay `, () => {
					const input1 = `a || b`
					const input2 = `prop:group1(a || b)`
					const input3 = `prop:group(a || b) `.repeat(50)

					const start1 = performance.now()
					const ast1 = new Parser({ expandedPropertySeparator: ":" }).parse(input1)
					const end1 = performance.now()
					const start2 = performance.now()
					const ast2 = new Parser({ expandedPropertySeparator: ":" }).parse(input2)
					const end2 = performance.now()
					const start3 = performance.now()
					const ast3 = new Parser({ expandedPropertySeparator: ":" }).parse(input3)
					const end3 = performance.now()

					const timeSimple = end1 - start1
					const timeGroup = end2 - start2
					const timeManyGroups = end3 - start3
					// console.log({ timeSimple, timeGroup, timeManyGroups })

					// * 2 because a group expression requires 2 parser initializations
					// + 2 for variations
					expect(timeGroup).to.be.lessThan(timeSimple * 4)

					// * 1 because parsing one group or multiple groups should take about the same since the sub parser is re-used
					// disabled (... not sure why it's not sooo variable, still very fast anyways)
					// expect(timeManyGroups).to.be.lessThan(timeGroup * ___)

					// nothing should take more than 100 ms
					expect(timeSimple).to.be.lessThan(100)
					expect(timeGroup).to.be.lessThan(100)
					expect(timeManyGroups).to.be.lessThan(100)
				})
				it(`prop:OP(())`, () => {
					const input = `prop:OP(())`
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)

					const expected = condition(
						group(undefined, group(undefined, e(input, "((", [TOKEN_TYPE.VALUE]))),
						true,
						v(input, "prop"),
						t(input, "OP"),
						{
							left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
							right: undefined,
						},
					)

					expect(ast).to.deep.equal(expected)
				})
				it(`prop:OP(()`, () => {
					const input = `prop:OP(()`
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)

					const expected = condition(
						group(undefined, group(undefined, e(input, "((", [TOKEN_TYPE.VALUE])), delim(true, false)),
						true,
						v(input, "prop"),
						t(input, "OP"),
						{
							left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
							right: undefined,
						},
					)
					expect(ast).to.deep.equal(expected)
				})
				it(`prop:OP())`, () => {
					const input = `prop:OP())`
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)

					const expected = group(undefined,
						condition(
							group(undefined, e(input, "(", [TOKEN_TYPE.VALUE])),
							true,
							v(input, "prop"),
							t(input, "OP"),
							{
								left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
								right: undefined,
							},
						),
						delim(false, true))
					expect(ast).to.deep.equal(expected)
				})
				it(`prop:OP((`, () => {
					const input = `prop:OP((`
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)

					const expected = condition(
						group(undefined, group(undefined, e(input, "((", [TOKEN_TYPE.VALUE]), delim(true, false)), delim(true, false)),
						true,
						v(input, "prop"),
						t(input, "OP"),
						{
							left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
							right: undefined,
						},
					)
					expect(ast).to.deep.equal(expected)
				})
				it(`prop:OP))`, () => {
					const input = `prop:OP))`
					const ast = new Parser({ expandedPropertySeparator: ":", arrayValues: true }).parse(input)

					const expected =
							group(undefined,
								group(undefined,
									condition(
										e(input, "OP", [TOKEN_TYPE.VALUE]),
										true,
										v(input, "prop"),
										t(input, "OP"),
										{
											left: t(input, ":", TOKEN_TYPE.OP_EXPANDED_SEP),
											right: undefined,
										},
									),
									delim(false, true),
								),
								delim(false, true),
							)
					expect(ast).to.deep.equal(expected)
				})
			})
		})
	})
	it(`other odd combinations not to throw`, () => {
		[
			`:(:`,
			`:):`,
			`:():`,
			`()::`,
			`)::`,
			`(::`,
			`::()`,
			`::(`,
			`::)`,
			`():`,
			`(:`,
			`):`,
			`:()`,
			`:(`,
			`:)`,
			`(:)`,
			`(:`,
			`:)`,
		].forEach(input => {
			expect(() => {
				new Parser({ expandedPropertySeparator: ":" }).parse(input)
			}).to.not.throw()
		})
	})
})
