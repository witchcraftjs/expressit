import { defineConfig } from "drizzle-kit"
export default defineConfig({
	dialect: "postgresql",
	schema: "tests/db/schema.ts",
	out: "tests/db/migrations",
})
