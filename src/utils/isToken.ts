import type { ErrorToken, ValidToken } from "../types/ast.js"

/**
 * A simple wrapper around checking an object's `isToken` property that casts the object to a {@link ValidToken} or {@link ErrorToken} for typescript.
 *
 * Does not actually do any checking of the object, and assumes the object was created using one of the `create*` functions.
 */
export function isToken(token: any): token is ValidToken | ErrorToken {
	return token?.isToken === true
}
