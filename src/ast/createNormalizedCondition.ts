import { AST_TYPE, type NormalizedCondition } from "../types/ast.js"


export function createCondition<
	TOp extends string = string,
	TValue = any,
>(raw: Omit<NormalizedCondition<TOp, TValue>, "type">): NormalizedCondition<TOp, TValue> {
	return {
		...raw,
		type: AST_TYPE.NORMALIZED_CONDITION,
	}
}
