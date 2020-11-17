/* eslint-disable no-labels */

import type { AddParameters } from "@utils/types"
import { unreachable } from "@utils/utils"

import { Condition, Expression } from "@/ast/classes"
import { TOKEN_TYPE } from "@/types"


export class GetIndexMixin<T> {
	/**
	 * Returns a list of the different sets of keys that need to be indexed to run a normalized query on a database and hit an existing index.
	 *
	 * For example, the expression `a || b` requires both `a` AND `b` be indexed to use an index. The function would return `[Set(a, b)]`.
	 *
	 * On the otherhand, the expression `a && b` only requires `a` OR `b` to be indexed (`[Set(a), Set(b)]`) If at least one is indexed, the rest of the filtering can be done in memory. There is no need to in memory filter the entire database.
	 *
	 * Now take a more complicated query like `(a && b) || (a && c)`. This only requires `a` be indexed, or both `b` AND `c`. (`[Set(a)], [Set(b), Set(c)]`).
	 *
	 * Queries like `(a || b) && (a || c)` would require all the variables to be indexed `[Set(a), Set(b), Set(c)]`.
	 */
	getIndexes(ast: Condition | Expression): Set<string>[] {
		const self_ = this as any as GetIndexMixin<T> & { indexes: AddParameters<GetIndexMixin<T>["getIndexes"], []> }
		if (ast instanceof Condition) {
			return [new Set(ast.property.join("."))]
		}
		if (ast instanceof Expression) {
			const left = self_.getIndexes(ast.left)
			const right = self_.getIndexes(ast.right)

			if (ast.operator === TOKEN_TYPE.AND) {
				const sets: Set<string>[] = []
				const allKeys: Set<string> = new Set()

				for (const leftSet of left) {
					const exists = sets.find(set => isEqualSet(set, leftSet))
					if (exists) continue
					sets.push(leftSet)
					for (const key of leftSet) {
						allKeys.add(key)
					}
				}
				for (const rightSet of right) {
					const exists = sets.find(set => isEqualSet(set, rightSet))
					if (exists) continue
					sets.push(rightSet)
					for (const key of rightSet) {
						allKeys.add(key)
					}
				}

				const commonKeys: Set<string> = new Set()

				outerCheck: for (const key of allKeys) {
					for (const set of sets) {
						if (!set.has(key)) continue outerCheck
					}
					commonKeys.add(key)
				}
				if (commonKeys.size > 0) {
					return [commonKeys, allKeys]
				} else {
					return sets
				}
			}
			if (ast.operator === TOKEN_TYPE.OR) {
				for (const rightSet of right) {
					for (const leftSet of left) {
						if (isEqualSet(leftSet, rightSet)) {
							return [rightSet]
						}
					}
				}
				const res = new Set<string>()
				for (const leftSet of left) {
					for (const key of leftSet) {
						res.add(key)
					}
				}
				for (const rightSet of right) {
					for (const key of rightSet) {
						res.add(key)
					}
				}
				return [res]
			}
		}

		return unreachable()
	}
}

function isEqualSet(setA: Set<any>, setB: Set<any>): boolean {
	if (setA.size !== setB.size) return false
	for (const key of setA) {
		if (!setB.has(key)) return false
	}
	return true
}
