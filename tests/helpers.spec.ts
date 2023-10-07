import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { getUnclosedRightParenCount } from "../src/helpers/parser/getUnclosedRightParenCount.js"
import { Parser } from "../src/parser.js"


describe(testName({ __filename }), () => {
	it("unclosedRightParenCount", () => {
		const parser = new Parser()
		// @ts-expect-error tokens is private
		const tokens = parser.tokens
		// @ts-expect-error lex is private
		const lex = parser._lex.bind(parser)

		expect(getUnclosedRightParenCount(lex(")((())))))").tokens, tokens)).to.equal(4)
		expect(getUnclosedRightParenCount(lex("()").tokens, tokens)).to.equal(0)
		expect(getUnclosedRightParenCount(lex(")(").tokens, tokens)).to.equal(1)
		expect(getUnclosedRightParenCount(lex("()))").tokens, tokens)).to.equal(2)
		expect(getUnclosedRightParenCount(lex(")(((((((((((").tokens, tokens)).to.equal(1)
		expect(getUnclosedRightParenCount(lex("\\)").tokens, tokens)).to.equal(0)
		expect(getUnclosedRightParenCount(lex("\\(").tokens, tokens)).to.equal(0)
	})
})
