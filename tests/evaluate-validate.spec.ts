import { get, isArray, testName, unreachable } from "@alanscodelog/utils"
import { describe, expect, it, vi } from "vitest"

import { nCondition, nExpression } from "./utils.js"

import type { GroupNode } from "../src/ast/classes/GroupNode.js"
import { ValidToken } from "../src/ast/classes/ValidToken.js"
import { VariableNode } from "../src/ast/classes/VariableNode.js"
import { applyBoolean } from "../src/helpers/general/applyBoolean.js"
import { defaultConditionNormalizer } from "../src/helpers/general/defaultConditionNormalizer.js"
import { defaultValueComparer } from "../src/helpers/general/defaultValueComparer.js"
import { Parser } from "../src/parser.js"
import type { FullParserOptions, ValidationQuery, ValueValidator } from "../src/types/parser.js"


describe(testName(), () => {
	it("applyBoolean helper works", () => {
		expect(applyBoolean(true, true)).to.equal(true)
		expect(applyBoolean(true, false)).to.equal(false)
		expect(applyBoolean(false, false)).to.equal(true)
		expect(applyBoolean(false, true)).to.equal(false)
	})
	describe("evaluate", () => {
		const opts = { regexValues: false, arrayValues: false }
		it("a || b", () => {
			const input = "a || b"
			const parser = new Parser(opts)
			const ast = parser.parse(input)
			const normalized = parser.normalize(ast)

			expect(parser.evaluate(normalized, { a: true, b: true })).equal(true)
			expect(parser.evaluate(normalized, { a: true, b: false })).equal(true)
			expect(parser.evaluate(normalized, { a: false, b: false })).equal(false)
			expect(parser.evaluate(normalized, { a: false, b: true })).equal(true)

			const expectedNormalized = nExpression(nCondition("a"), "||", nCondition("b"))
			expect(normalized).to.deep.equal(expectedNormalized)
		})
		it("a && b", () => {
			const input = "a && b"
			const parser = new Parser(opts)
			const ast = parser.parse(input)
			const normalized = parser.normalize(ast)
			expect(parser.evaluate(normalized, { a: true, b: true })).equal(true)
			expect(parser.evaluate(normalized, { a: true, b: false })).equal(false)
			expect(parser.evaluate(normalized, { a: false, b: false })).equal(false)
			expect(parser.evaluate(normalized, { a: false, b: true })).equal(false)

			const expectedNormalized = nExpression(nCondition("a"), "&&", nCondition("b"))
			expect(normalized).to.deep.equal(expectedNormalized)
		})
		describe("de Morgan's laws", () => {
			it("!a || !b", () => {
				const input = "!a || !b"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { a: true, b: true })).equal(false)
				expect(parser.evaluate(normalized, { a: true, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: true })).equal(true)

				const expectedNormalized = nExpression(nCondition("a", true, true), "||", nCondition("b", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("!(a && b)", () => {
				const input = "!(a && b)"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { a: true, b: true })).equal(false)
				expect(parser.evaluate(normalized, { a: true, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: true })).equal(true)

				const expectedNormalized = nExpression(nCondition("a", true, true), "||", nCondition("b", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("!(a || b)", () => {
				const input = "!(a || b)"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { a: true, b: true })).equal(false)
				expect(parser.evaluate(normalized, { a: true, b: false })).equal(false)
				expect(parser.evaluate(normalized, { a: false, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: true })).equal(false)

				const expectedNormalized = nExpression(nCondition("a", true, true), "&&", nCondition("b", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("!a && !b", () => {
				const input = "!a && !b"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { a: true, b: true })).equal(false)
				expect(parser.evaluate(normalized, { a: true, b: false })).equal(false)
				expect(parser.evaluate(normalized, { a: false, b: false })).equal(true)
				expect(parser.evaluate(normalized, { a: false, b: true })).equal(false)

				const expectedNormalized = nExpression(nCondition("a", true, true), "&&", nCondition("b", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
		})
		describe("prefixes + de Morgan's laws", () => {
			it("a(b || c)", () => {
				const input = "a(b || c)"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { ab: true, ac: true })).equal(true)
				expect(parser.evaluate(normalized, { ab: true, ac: false })).equal(true)
				expect(parser.evaluate(normalized, { ab: false, ac: false })).equal(false)
				expect(parser.evaluate(normalized, { ab: false, ac: true })).equal(true)

				const expectedNormalized = nExpression(nCondition("ab", true), "||", nCondition("ac", true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("!a(b && c)", () => {
				const input = "!a(b && c)"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { ab: true, ac: true })).equal(false)
				expect(parser.evaluate(normalized, { ab: true, ac: false })).equal(true)
				expect(parser.evaluate(normalized, { ab: false, ac: false })).equal(true)
				expect(parser.evaluate(normalized, { ab: false, ac: true })).equal(true)

				const expectedNormalized = nExpression(nCondition("ab", true, true), "||", nCondition("ac", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("!a(b || c)", () => {
				const input = "!a(b || c)"
				const parser = new Parser(opts)
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { ab: true, ac: true })).equal(false)
				expect(parser.evaluate(normalized, { ab: true, ac: false })).equal(false)
				expect(parser.evaluate(normalized, { ab: false, ac: false })).equal(true)
				expect(parser.evaluate(normalized, { ab: false, ac: true })).equal(false)

				const expectedNormalized = nExpression(nCondition("ab", true, true), "&&", nCondition("ac", true, true))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
		})
		describe("prefixes + property conditions", () => {
			it("a(b:val)", () => {
				const input = "a(b:val)"
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					valueComparer: (...args) => defaultValueComparer(...args),
					conditionNormalizer: (...args) => defaultConditionNormalizer(...args),
				})
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { ab: "val" })).equal(true)
				expect(parser.evaluate(normalized, { ab: "val2" })).equal(false)

				const expectedNormalized = nCondition("ab", "val", false, ":")
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it("a:op(val or val2)", () => {
				const input = "a:op(val || val2)"
				const parser = new Parser({
					customPropertyOperators: [":"],
					expandedPropertySeparator: ":",
					valueComparer: (...args) => defaultValueComparer(...args),
					conditionNormalizer: (...args) => defaultConditionNormalizer(...args),
				})
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)

				expect(parser.evaluate(normalized, { a: "val" })).equal(true)
				expect(parser.evaluate(normalized, { a: "val2" })).equal(true)
				expect(parser.evaluate(normalized, { a: "val3" })).equal(false)

				const expectedNormalized = nExpression(nCondition("a", "val", false, "op"), "||", nCondition("a", "val2", false, "op"))
				expect(normalized).to.deep.equal(expectedNormalized)
			})
		})
		describe("custom validation", () => {
			it("a(b:val)", () => {
				const input = "a(b:val)"
				const valueValidator = vi.fn((_contextValue: string, query: ValidationQuery) => {
					expect(query.value).to.be.instanceof(VariableNode)
					expect(query.property[0]).to.be.instanceof(VariableNode)
					expect(query.property[1]).to.be.instanceof(VariableNode)
					expect(query.property[0].value.value).to.equal("a")
					expect(query.property[1].value.value).to.equal("b")
					expect((query.value as VariableNode).value.value).to.equal("val")
					expect(query.operator).to.be.instanceof(ValidToken)
					expect(query.prefix).to.equal(undefined)
				})
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					valueComparer: (...args) => defaultValueComparer(...args),
					valueValidator: valueValidator as any,
				})
				const ast = parser.parse(input)
				parser.validate(ast)
				expect(valueValidator.mock.calls.length).to.equal(1)
			})
			it("a(b)", () => {
				const input = "a(b)"
				const valueValidator = vi.fn((_contextValue: string, query: ValidationQuery) => {
					expect(query.property[0]).to.be.instanceof(VariableNode)
					expect(query.property[1]).to.be.instanceof(VariableNode)
					expect(query.property[0].value.value).to.equal("a")
					expect(query.property[1].value.value).to.equal("b")
					expect(query.value).to.equal(true)
					expect(query.operator).to.equal(undefined)
					expect(query.prefix).to.equal(undefined)
				})
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					valueComparer: (...args) => defaultValueComparer(...args),
					valueValidator: valueValidator as any,
				})
				const ast = parser.parse(input)
				parser.validate(ast)
				expect(valueValidator.mock.calls.length).to.equal(1)
			})
			it(`a(prefix"b")`, () => {
				const input = `a(prefix"b")`
				const valueValidator = vi.fn((_contextValue: string | undefined, query: ValidationQuery) => {
					expect(query.property[0]).to.be.instanceof(VariableNode)
					expect(query.property[1]).to.be.instanceof(VariableNode)
					expect(query.property[0].value.value).to.equal("a")
					expect(query.property[1].value.value).to.equal("b")
					expect(query.value).to.equal(true)
					expect(query.operator).to.equal(undefined)
					expect(query.prefix).to.be.instanceof(ValidToken)
					expect(query.prefix!.value).to.equal("prefix")
					return [{
						start: query.property[0].start,
						end: query.property[0].end,
						custom: "custom",
					}]
				})
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					prefixableStrings: ["prefix"],
					valueComparer: (...args) => defaultValueComparer(...args),
					valueValidator: valueValidator as ValueValidator<any>,
				})
				const ast = parser.parse(input)
				const errors = parser.validate(ast)
				expect(errors).to.deep.equal([{
					start: (ast as GroupNode).prefix?.start,
					end: (ast as GroupNode).prefix?.end,
					custom: "custom",
				}])

				expect(valueValidator.mock.calls.length).to.equal(1)
			})
			it(`a(a:prefix"b") normalization`, () => {
				const input = `a(a:prefix"b")`
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					prefixableStrings: ["prefix"],
					valueComparer: (...args) => defaultValueComparer(...args),
					conditionNormalizer: (...args) => defaultConditionNormalizer(...args),
				})
				const ast = parser.parse(input)
				const normalized = parser.normalize(ast)
				const expectedNormalized = nCondition("aa", "b", false, ":")
				expect(normalized).to.deep.equal(expectedNormalized)
			})
			it(`a(c(d)) || e - partial prefix "highlighting"`, () => {
				const input = `a(c(d)) || e`
				const valueValidator = vi.fn((_contextValue: string | undefined, query: ValidationQuery, context: any): any => {
					const values = query.property.map(node => node.value.value)
					let i = 1
					while (i < query.property.length && get(context, values.slice(0, i)) !== undefined) {
						i++
					}
					if (i !== 0) {
						const invalid = query.property.slice(i - 1, query.property.length)
							.map(node => ({
								// use the node position to include any quotes in the position
								start: node.start,
								end: node.end,
								type: "InvalidPrefix",
								value: node.value.value,
							}))
						invalid[0].type = query.property.length === 1
							? "InvalidVariable"
							: "InvalidPrefixBranch"

						return invalid
					}
				})
				const parser = new Parser({
					...opts,
					customPropertyOperators: [":"],
					prefixableStrings: ["prefix"],
					valueComparer: (...args) => defaultValueComparer(...args),
					valueValidator: valueValidator as ValueValidator<any>,
				})
				const ast = parser.parse(input)
				const errors = parser.validate(ast, { a: { b: { c: true } } })

				expect(errors).to.deep.equal([
					{
						start: (ast as any).left.expression.prefix.value.start,
						end: (ast as any).left.expression.prefix.value.end,
						type: "InvalidPrefixBranch",
						value: "c",
					},
					{
						start: (ast as any).left.expression.expression.value.start,
						end: (ast as any).left.expression.expression.value.end,
						type: "InvalidPrefix",
						value: "d",
					},
					{
						start: (ast as any).right.value.start,
						end: (ast as any).right.value.end,
						type: "InvalidVariable",
						value: "e",
					},
				])
				expect(valueValidator.mock.calls.length).to.equal(2)
			})
		})
		describe("regex values", () => {
			const regexOpts: Partial<FullParserOptions> = {
				regexValues: true,
				valueComparer: (condition, contextValue, context): boolean => {
					expect(condition.value).to.be.instanceOf(RegExp)
					if (condition.property.length === 0) {
						return Object.values(context).find((contextVal: any) => contextVal.match(condition.value) !== null) !== undefined
					}
					return contextValue.match(condition.value) !== null
				},
				conditionNormalizer: ({ isRegex, isNegated, value, regexFlags }): { value: any, operator: any, negate: boolean } => {
					if (isRegex) {
						return { value: new RegExp(value as string, regexFlags), operator: "regex", negate: isNegated }
					}
					return unreachable()
				},
				valueValidator: (_contextValue, query): any => {
					if (query.isRegex) {
						if (query.property?.length === 0) return [query.value]
						if (query.property.length === 1 && query.property[0].value.value === "prefix") return [query.value]
					}
				},
			}
			it("/regex/", () => {
				const input = "/regex/"
				const parser = new Parser({
					...opts,
					...regexOpts,
				})
				const ast = parser.parse(input)

				const normalized = parser.normalize(ast)

				expect(parser.validate(ast).length).to.equal(1)
				expect(parser.evaluate(normalized, { a: "val" })).equal(false)
				expect(parser.evaluate(normalized, { a: "regex" })).equal(true)
			})
			it("prefix(/regex/)", () => {
				const input = "prefix(/regex/)"
				const parser = new Parser({
					...opts,
					...regexOpts,
				})
				const ast = parser.parse(input)
				expect(parser.validate(ast).length).to.equal(1)
			})
			describe("array values", () => {
				const arrayOpts: Partial<FullParserOptions> = {
					arrayValues: true,
					valueComparer: (condition): boolean => {
						if (condition.property.length === 0 && isArray(condition.value)) {
							return false
						}
						return true
					},
					valueValidator: (_contextValue, query): any => {
						if (isArray(query.value)) {
							if (query.property?.length === 0) return [query.value]
							if (query.property.length === 1 && query.property[0].value.value === "prefix") return [query.value]
						}
					},
				}
				it("[array]", () => {
					const input = "[array]"
					const parser = new Parser({
						...opts,
						...arrayOpts,
					})
					const ast = parser.parse(input)
					const normalized = parser.normalize(ast)

					expect(parser.validate(ast).length).to.equal(1)
					expect(parser.evaluate(normalized, { a: ["array"]})).equal(false)

					const expectedNormalized = nCondition(undefined, ["array"])
					expect(normalized).to.deep.equal(expectedNormalized)
				})
				it("prefix([array])", () => {
					const input = "prefix([array])"
					const parser = new Parser({
						...opts,
						...arrayOpts,
					})
					const ast = parser.parse(input)

					expect(parser.validate(ast).length).to.equal(1)
				})
			})
		})
	})
})
