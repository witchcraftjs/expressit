// careful, we can't use nuxt paths because of drizzle
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core"


export const testEntry = pgTable("testEntry", {
	id: integer("id").primaryKey().notNull(),
	boolean: boolean("boolean").notNull(),
	number: integer("number").notNull(),
	string: text("string").notNull(),
	date: timestamp("date").notNull(),
	array: text("array").array().notNull(),
})

export const testEntryJson = pgTable("testEntry2", {
	id: integer("id").primaryKey().notNull(),
	json: jsonb("json").notNull(),
})

