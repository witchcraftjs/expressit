import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { t, v } from "./utils.js"

import { condition, delim } from "../src/ast/builders/index.js"
import { Parser } from "../src/parser.js"


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
