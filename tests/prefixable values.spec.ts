import { testName } from "@utils/testing"

import { expect } from "./chai"
import { t, v } from "./utils"

import { condition, delim } from "@/ast/builders"
import { Parser } from "@/index"


describe(testName({ __filename }), () => {
	it(`prefix"a"`, () => {
		const input = `prefix"a"`
		const ast = new Parser({ prefixableStrings: ["prefix"]}).parse(input)
		const expected = condition(
			v(input, "a", delim("\"", "\""), t(input, "prefix"))
		)
		expect(ast).to.deep.equal(expected)
	})
	// todo more tests
})
