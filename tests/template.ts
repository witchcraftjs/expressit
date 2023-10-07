import { testName } from "@alanscodelog/utils"
import { describe, expect, it } from "vitest"


describe(testName({ __filename }), () => {
	it("works", () => {
		expect(true).to.equal(false)
	})
})

