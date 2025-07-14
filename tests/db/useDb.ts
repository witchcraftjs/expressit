import { readMigrationFiles } from "drizzle-orm/migrator"
import path from "path"
import url from "url"
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const tests = path.resolve(__dirname)
const folder = path.resolve(tests, "migrations")
const schema = path.resolve(tests, "schema.ts")

import { testEntry } from "./schema.js"

const migrations = readMigrationFiles({
	migrationsFolder: folder,
	migrationsSchema: schema
})

import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

const client = new PGlite()
const db = drizzle(client)

export async function useDb() {
	async function migrate() {
		return (db as any).dialect.migrate(migrations, (db as any).session, { })
	}
	await migrate()
	async function clearDb() {
		await db.delete(testEntry)
		await migrate()
	}
	return { db, clearDb }
}
