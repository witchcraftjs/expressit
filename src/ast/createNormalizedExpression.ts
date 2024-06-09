import { AST_TYPE, type NormalizedExpression } from "../types/ast.js"


export function createExpression<TType extends string = string, TValue = any>(raw: Omit<NormalizedExpression<TType, TValue>, "type">): NormalizedExpression<TType, TValue> {
	return {
		...raw,
		type: AST_TYPE.NORMALIZED_EXPRESSION
	}
}
