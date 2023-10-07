import type { ArrayNode } from "./ArrayNode.js"
import type { ConditionNode } from "./ConditionNode.js"
import type { ExpressionNode } from "./ExpressionNode.js"
import type { GroupNode } from "./GroupNode.js"

import { BooleanParserLibraryError } from "../../helpers/errors.js"
import type { AST_TYPE } from "../../types/ast.js"
import { ERROR_CODES } from "../../types/errors.js"

/**
 * The base AST node class all node types extend from. Can be used to check if an object is an ast node.
 * ```ts
 * if (group.prefix instanceof Node) {
 * 	//...
 * }
 * ```
 */
export class Node<
	TType extends AST_TYPE = AST_TYPE,
	TValid extends boolean = boolean,
> {
	readonly type: TType

	readonly start: number

	readonly end: number

	readonly valid!: TValid

	get parent():
	ConditionNode |
	GroupNode |
	ExpressionNode |
	ArrayNode |
	undefined {
		return undefined as any
	}

	constructor(type: TType, start: number, end: number) {
		this.type = type
		if (start === undefined || end === undefined) {
			throw new BooleanParserLibraryError(ERROR_CODES.PARSER_POSITION_ERROR, { start, end })
		}
		this.start = start
		this.end = end
	}
}
