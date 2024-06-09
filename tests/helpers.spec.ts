import { describe, expect, it } from "vitest"

import { getUnclosedRightParenCount } from "../src/internal/getUnclosedRightParenCount.js"
import { Lexer } from "../src/Lexer.js"
import { Parser } from "../src/Parser.js"


it("unclosedRightParenCount", () => {
	const parser = new Lexer()
	const lex = (input: string) => parser.tokenize(input)

	expect(getUnclosedRightParenCount(lex(")((())))))"))).to.equal(4)
	expect(getUnclosedRightParenCount(lex("()"))).to.equal(0)
	expect(getUnclosedRightParenCount(lex(")("))).to.equal(1)
	expect(getUnclosedRightParenCount(lex("()))"))).to.equal(2)
	expect(getUnclosedRightParenCount(lex(")((((((((((("))).to.equal(1)
	expect(getUnclosedRightParenCount(lex("\\)"))).to.equal(0)
	expect(getUnclosedRightParenCount(lex("\\("))).to.equal(0)
})
