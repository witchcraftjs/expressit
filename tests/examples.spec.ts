import { testName } from "@utils/testing"

import { ShortcutContextParser } from "@/examples/shortcutContextParser"
import { expect } from "@tests/chai"


describe(testName(), () => {
	describe("shortcutContextParser", () => {
		it("ContextParser", () => {
			const dummyContext = {
				a: { b: { c: false } },
				d: false,
				e: true,
			}
			const parser = new ShortcutContextParser(dummyContext)
			expect(parser.validKeys).to.deep.equal(["a.b.c", "d", "e"])
			expect(parser.regexablekeys).to.deep.equal(["e"])
			const input = "a.(b(c)) || e != /regex/"

			const ast = parser.parse(input)
			const normalized = parser.normalize(ast)

			expect(parser.validate(ast)).to.deep.equal([])

			const context = {
				a: { b: { c: true } },
				d: true,
				e: "regexable",
			}
			expect(parser.evaluate(normalized, context)).to.equal(true)
		})
		it("ContextParser - errors", () => {
			const context = {
				a: { b: { c: true } },
				d: true,
				e: false,
			}
			const parser = new ShortcutContextParser(context)
			const input = "a(b(invalid)) || e == /regex/ww"

			const ast = parser.parse(input)

			expect(parser.validate(ast)).to.deep.equal([
				{ start: 0, end: 1, type: "invalidKey" },
				{ start: 2, end: 3, type: "invalidKey" },
				{ start: 4, end: 11, type: "invalidKey" },
				{ start: 17, end: 18, type: "unregexableKey" },
				{ start: 29, end: 30, type: "invalidRegexFlag" },
				{ start: 30, end: 31, type: "duplicateRegexFlag" },
				{ start: 30, end: 31, type: "invalidRegexFlag" },
			])
		})
	})
})
