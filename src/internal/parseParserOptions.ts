import { defaultConditionNormalizer } from "../defaults/defaultConditionNormalizer.js"
import { defaultKeyParser } from "../defaults/defaultKeyParser.js"
import { defaultPrefixApplier } from "../defaults/defaultPrefixApplier.js"
import { defaultValueComparer } from "../defaults/defaultValueComparer.js"
import type { FullParserOptions, ParserOptions } from "../types/parser.js"

/** @internal */
export function parseParserOptions<T>(
	options: ParserOptions<T>,
): FullParserOptions<T> {
	const opts: ParserOptions<T> = {
		prefixApplier: defaultPrefixApplier,
		keyParser: defaultKeyParser,
		valueComparer: defaultValueComparer,
		conditionNormalizer: defaultConditionNormalizer,
		prefixableGroups: true,
		prefixableStrings: undefined,
		expandedPropertySeparator: undefined,
		customPropertyOperators: undefined,
		onMissingBooleanOperator: "error",
		arrayValues: true,
		regexValues: true,
		...options, // todo fix
		keywords: {
			or:
				options.keywords?.or
				? options.keywords.or as any
				: [
					{ value: "||", isSymbol: true },
					{ value: "|", isSymbol: true },
					{ value: "or", isSymbol: false },
					{ value: "OR", isSymbol: false },
				],
			and:
				options.keywords?.and
				? options.keywords.and as any
				: [
					{ value: "&&", isSymbol: true },
					{ value: "&", isSymbol: true },
					{ value: "and", isSymbol: false },
					{ value: "AND", isSymbol: false },
				],
			not:
				options.keywords?.not
				? options.keywords.not as any
				: [
					{ value: "!", isSymbol: true },
					{ value: "not", isSymbol: false },
					{ value: "NOT", isSymbol: false },
				],
		},
	}
	return opts as any
}
