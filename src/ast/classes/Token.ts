import type { ArrayNode } from "./ArrayNode"
import type { ConditionNode } from "./ConditionNode"
import type { ExpressionNode } from "./ExpressionNode"
import type { GroupNode } from "./GroupNode"
import type { VariableNode } from "./VariableNode"

import { BooleanParserLibraryError } from "@/helpers/errors"
import type { TOKEN_TYPE } from "@/types"
import { ERROR_CODES } from "@/types/errors"


/**
 * The base class from which @see ValidToken and @see ErrorToken extend.
 *
 * Mostly for internal use, and I would suggest using @see AnyToken instead of this for typing things, but can be used to check whether an object is a token:
 * ```ts
 * if (group.prefix instanceof Token) {
 * 	//...
 * }
 * ```
 * Only really takes care of setting the start/end position.
 */

export class Token<
	TValid extends boolean = boolean,
	TType extends
		TValid extends true ? TOKEN_TYPE : never =
		TValid extends true ? TOKEN_TYPE : never,
	TValue extends
		TValid extends true ? string : never =
		TValid extends true ? string : never,
	TExpected extends
		TValid extends false ? TOKEN_TYPE[] : never =
		TValid extends false ? TOKEN_TYPE[] : never,
> {
	readonly type!: TType
	readonly value!: TValue
	readonly expected!: TExpected
	readonly start!: number
	readonly end!: number
	get parent(): VariableNode |
	GroupNode |
	ExpressionNode |
	ArrayNode |
	ConditionNode {
		return undefined as any
	}
	constructor(start: number, end: number) {
		if (start === undefined || end === undefined) {
			throw new BooleanParserLibraryError(ERROR_CODES.PARSER_POSITION_ERROR, { start, end })
		}
		this.start = start
		this.end = end
	}
}
