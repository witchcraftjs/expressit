export class GetBestIndexesMixin {
	/**
	 * Given the set of indexes returned by {@link getBestIndex}, the set of existing indexes in a database, and the index to sort by\*, will return a list of the best/shortest sets of indexes.
	 *
	 * For example, given the query `a && b && c`, `getBestIndex` will return `[Set(a), Set(b)]`.
	 *
	 * Suppose we have indexes on all the variables and that the user wants to sort by `c`, this function will return [`Set(c)`].
	 *
	 * Suppose instead we have indexes only on `a` and `b` and that the user wants to sort by `c`, this function will return [`Set(a), Set(b)`]. Either can be picked by some other criteria (e.g. size of the indexes). Sort should then be done in memory.
	 *
	 * And then finally, if we have no existing indexes on any of the variables, the function will return `[]`.
	 *
	 * Note: This is a simple algorithm and is not designed to take into account instances where entries are indexed by two or more properties as their keys (i.e. multicolumn indexes).
	 *
	 * \* If the sort index is not in the list of existing indexes it is not taken into account.
	 */
	getBestIndexes(indexes: Set<string>[], existing: Set<string> | Map<string, number>, sortIndex: string = ""): Set<string>[] {
		indexes = indexes.filter(set => {
			for (const key of set) {
				if (!existing.has(key)) return false
			}
			return true
		})

		let finalIndexes = indexes

		if (existing.has(sortIndex)) {
			const indexesWithSortIndex = indexes.filter(set => set.has(sortIndex))
			if (indexesWithSortIndex.length > 0) finalIndexes = indexesWithSortIndex
		}


		let smallest = Infinity
		if (existing instanceof Map) {
			const scores = new Map<Set<string>, number>()
			for (const set of finalIndexes) {
				let score = 0
				for (const key of set) {
					score += existing.get(key) ?? 0
				}
				scores.set(set, score)
				smallest = score < smallest ? score : smallest
			}
			return indexes.filter(set => smallest === Infinity || scores.get(set) === smallest)
		} else {
			for (const set of finalIndexes) {
				smallest = set.size < smallest ? set.size : smallest
			}
			return indexes.filter(set => smallest === Infinity || set.size === smallest)
		}
	}
}

