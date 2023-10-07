import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"

import { defaultConditionNormalizer } from "../src/helpers/general/defaultConditionNormalizer.js"
import { defaultValueComparer } from "../src/helpers/general/defaultValueComparer.js"
import { Parser } from "../src/parser.js"


const parser = new Parser({
	conditionNormalizer: (...args) => defaultConditionNormalizer(...args),
	valueComparer: (...args) => defaultValueComparer(...args),
})

describe(testName({ __filename }), () => {
	it(`a || b`, () => {
		const input = "a || b"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a", "b"]].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set(["a", "b"]), "a")).to.deep.equal([["a", "b"]].map(keys => new Set(keys)))
	})
	it(`a && b`, () => {
		const input = "a && b"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a"], ["b"]].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set(["a"]), "a")).to.deep.equal([["a"]].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set(["b"]), "a")).to.deep.equal([["b"]].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set(), "a")).to.deep.equal([].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set("a"), "")).to.deep.equal(["a"].map(keys => new Set(keys)))
		expect(parser.getBestIndexes(indexes, new Set("b"), "")).to.deep.equal(["b"].map(keys => new Set(keys)))
	})
	it(`a && b && c`, () => {
		const input = "a && b && c"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a"], ["b"], ["c"]].map(keys => new Set(keys)))
	})
	it(`(a && b) || (a && c)`, () => {
		const input = "(a && b) || (a && c)"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a"]].map(keys => new Set(keys)))
	})
	it(`(a || b) && (a || c)`, () => {
		const input = "(a || b) && (a || c)"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a"], ["a", "b", "c"]].map(keys => new Set(keys)))
	})
	it(`(a) && (a || b) && (a || c)`, () => {
		const input = "(a) && (a || b) && (a || c)"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a"], ["a", "b", "c"]].map(keys => new Set(keys)))
	})
	it(`(a || b) && (a || b || c)`, () => {
		const input = "(a || b) && (a || b || c)"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a", "b"], ["a", "b", "c"]].map(keys => new Set(keys)))
	})
	it(`(a || b) && (c || d) && (e || f) && (g || h) && (i || j) && (k || l) && (m || n) && (o || p) && (q || r)`, () => {
		const input = "(a || b) && (c || d) && (e || f) && (g || h) && (i || j) && (k || l) && (m || n) && (o || p) && (q || r)"
		const normalized = parser.normalize(parser.parse(input))
		const indexes = parser.getIndexes(normalized)
		expect(indexes).to.deep.equal([["a", "b"], ["c", "d"], ["e", "f"], ["g", "h"], ["i", "j"], ["k", "l"], ["m", "n"], ["o", "p"], ["q", "r"]].map(keys => new Set(keys)))
	})
})
