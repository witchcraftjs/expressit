import { describe, expect, it } from "vitest"

import { t, v } from "./utils.js"

import { condition, delim } from "../src/ast/builders/index.js"
import { Parser } from "../src/Parser.js"


it(`prefix"a"`, () => {
	const input = `prefix"a"`
	const ast = new Parser({ prefixableStrings: ["prefix"]}).parse(input)
	const expected = condition(
		v(input, "a", delim("\"", "\""), t(input, "prefix")),
	)
	expect(ast).to.deep.equal(expected)
})
// todo more tests
