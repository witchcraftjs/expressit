import type { AnyToken, Position, ValidToken } from "./ast.js"


/**
 * Contains information regarding the tokens around a cursor position. Mostly for internally use by {@link autosuggest}.
 *
 * Notes:
 *
 * - There are no whitespace tokens because whitespace is not tokenized. `prev`, `at`, `next` properties that contain tokens are set looking only at the list of tokens extracted from the ast by {@link extractTokens}. This is why there is an extra `whitespace` property to tell us whether there is whitespace (i.e. a hole) between the cursor and the next/prev **valid** tokens or if it can't find any, the start/end of the input.
 * - If next/prev are invalid tokens, note that there are cases where more invalid tokens might follow them. To get them we can use {@link getSurroundingErrors} or we can just find their index in the tokens list and go forward/backward as needed:
 * ```ts
 * let i =  tokens.findIndex(t => t === info.next)
 * while (tokens[i] instanceof ErrorToken) {...}
 * ```
 *
 * Examples:
 *
 * ```js
 * aaaa| bbbb // tokens: ["aaaa", TokenError(operator), "bbbb"]
 *     ^
 * {
 * 	index: 4, // cursor position
 * 	at: undefined, // it's not inside a token
 * 	prev: "aaaa",
 * 	next: TokenError, // operator is missing to the right
 * 	// closest valid tokens to either side
 * 	valid: {
 * 		prev: "aaaa",
 * 		next: "bbbb",
 * 	},
 * 	// whether there is whitespace between the cursor and the next/prev valid tokens or start/end of input
 * 	whitespace: {
 * 		prev: false,
 * 		next: true,
 * 	}
 * }
 * ```
 * ```js
 * aaaa || bb|bb && cccc
 *           ^
 * {
 * 	index: 10,
 * 	at: "bbbb", // it's inside a token
 * 	prev: "||",
 * 	next: "&&",
 * 	valid: {
 * 		prev: "||",
 * 		next: "&&",
 * 	},
 * 	whitespace: {
 * 		prev: true,
 * 		next: true,
 * 	}
 * }
 * ```
 */
export type CursorInfo = {
	index: number
	/**
	 * The token the cursor is inside of. By "inside", we mean the ends of the token are before/after the cursor respectively (e.g. `a|a`, but NOT `|aa` or `aa|`). This token, if defined, is always a valid token, since error tokens have no length.
	 *
	 * Note though that there are cases where one might be inside a variable but not inside a token because quotes are their own tokens (e.g. `"|var"` or `"var|"`).
	 */
	at?: ValidToken
	/** The first token, valid or invalid, that starts at or after the index position. */
	next?: AnyToken
	/** The first token (going backwards), valid or invalid, that ends at or before the index position. */
	prev?: AnyToken
	/** Closest valid tokens. */
	valid: {
		/** Closest prev valid token. */
		next?: ValidToken
		/** Closest next valid token. */
		prev?: ValidToken
	}
	/** Whether there is whitespace between the cursor and the next/prev valid tokens or start/end of the input. */
	whitespace: {
		/** Whether there is whitespace between the cursor and the next valid token or the end of the input. */
		next: boolean
		/** Whether there is whitespace between the cursor and the prev valid token or the start of the input. */
		prev: boolean
	}
}

export enum SUGGESTION_TYPE {
	// can ignore whitespace requirement if replacing with quoted
	VARIABLE = "VARIABLE",
	ARRAY_VALUE = "ARRAY_VALUE",
	VALUE = "VALUE",
	PREFIX = "PREFIX",
	BOOLEAN_WORD_OP = "BOOLEAN_WORD_OP",
	BOOLEAN_SYMBOL_OP = "BOOLEAN_SYMBOL_OP",
	BACKTICK = "BACKTICK",
	DOUBLEQUOTE = "DOUBLEQUOTE",
	SINGLEQUOTE = "SINGLEQUOTE",
	PARENL = "PARENL",
	PARENR = "PARENR",
	PROPERTY = "PROPERTY",
	EXPANDED_PROPERTY_OPERATOR = "EXPANDED_PROPERTY_OPERATOR",
	CUSTOM_PROPERTY_OPERATOR = "CUSTOM_PROPERTY_OPERATOR",
	PROPERTY_SEP = "PROPERTY_SEP",
	BRAKCETR = "BRAKCETR",
	REGEX = "REGEX",
	REGEX_FLAGS = "REGEX_FLAGS",
	/** This is not an oversight, I haven't figured out a fast way to detect left bracket errors. */
	// BRAKCETL = "BRAKCETL",
}

/**
 * A suggestion entry that describes a type of suggestion.
 */
export type Suggestion = {
	type: SUGGESTION_TYPE
	/** The range the suggestion should replace / be inserted at. */
	range: Position
	/** {@link CursorInfo} */
	cursorInfo: CursorInfo
	/** Tells us any additional requirements for inserting the suggestion. */
	requires: {
		/**
		 * Whether the suggestions requires inserting whitespace before/after to keep the intent of the expression consistent. For example, an unquoted variable needs a space between it and a non-symbol operator.
		 *
		 * In the case of variables this requirement can be ignored though if you insert a quoted value.
		 */
		whitespace: {
			after: boolean
			before: boolean
		}
		/**
		 * If prefixableGroups is enabled, a suggestion can be a prefix suggestion and this tells us whether `()` needs to be inserted at the end in the case it does not already exist.
		 *
		 * For example, a user might choose to insert a prefix in this situation `a && |` and we want the result to be `a && prefix()` because without the `()` the prefix will probably be an invalid variable name on insertion.
		 *
		 * The opposite happens with an existing prefix where the user might want to replace it. `a && existing|(...)`. We want the result to be `a && replacement(...)` not `a && replacement()(...)`.
		 */
		group: boolean
		/** If `prefixableValues` is enabled and a value is prefixed, contains the prefix it was prefixed with. Note that the prefix is included in the range. This way you can choose to suggest/replace just the prefix, just the value or both. */
		prefix: string | false
	}
	/**
	 * Whether the suggestion was created because there was an error token there and it would fix it.
	 */
	isError: boolean
}


export type Completion = {
	suggestion: Suggestion
	value: string
}
