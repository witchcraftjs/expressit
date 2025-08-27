import { isBlank } from "@alanscodelog/utils/isBlank"
import { pushIfNotIn } from "@alanscodelog/utils/pushIfNotIn"

import { ExpressitError } from "./ExpressitError.js"

import { defaultConditionNormalizer } from "../defaults/defaultConditionNormalizer.js"
import { defaultValueComparer } from "../defaults/defaultValueComparer.js"
import { PARSER_ERROR } from "../types/errors.js"
import type { FullParserOptions, ParserOptions } from "../types/parser.js"

/** @internal */
export function checkParserOpts<T>(opts: FullParserOptions<T>, evaluatorChecks: boolean = false, validatorChecks: boolean = false): void {
	if (!evaluatorChecks) {
		const keywordsList = [...opts.keywords.and, ...opts.keywords.or, ...opts.keywords.not].map(keyword => keyword.value)
		const symNots = opts.keywords.not.filter(op => op.isSymbol).map(op => op.value)
		const keywords = [
			...[...keywordsList].filter(val => !symNots.includes(val)),
			...["(", ")"],
			...(opts.arrayValues ? ["[", "]"] : []),
			...(opts.regexValues ? ["/"] : []),
		]
		const extra: string[] = []
		if (opts.expandedPropertySeparator) extra.push(opts.expandedPropertySeparator)
		if (opts.customPropertyOperators) pushIfNotIn(extra, opts.customPropertyOperators)


		/* #region Blank Operator Checks */
		if (opts.expandedPropertySeparator && isBlank(opts.expandedPropertySeparator)) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: [""], invalid: opts.expandedPropertySeparator },
			`expandedPropertySeparator cannot be blank`,
			)
		}
		const customInvalid = opts.customPropertyOperators?.find(_ => isBlank(_))
		if (customInvalid !== undefined) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: [""], invalid: customInvalid },
			`customPropertyOperators cannot contain blank entries`,
			)
		}
		const prefixInvalid = opts.prefixableStrings?.find(_ => isBlank(_))
		if (prefixInvalid !== undefined) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: [""], invalid: prefixInvalid },
			`prefixableStrings cannot contain blank entries`,
			)
		}
		for (const key of ["and", "or", "not"] as const) {
			const invalid = opts.keywords[key]
				?.find(_ => isBlank(_.value))
				?.value
			if (invalid !== undefined) {
				throw new ExpressitError(
					PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
					{ prohibited: [""], invalid },
				`keywords.${key} cannot contain entries with blank values`,
				)
			}
		}
		/* #regionend */

		/* #region Prohibited Keyword Checks */
		const all = [...keywords, ...symNots, ...extra]
		const allKeywords = [...keywords, ...symNots]
		/**
		 * Allowed:
		 * - custom property operators can be the same as symbol not operators
		 * - custom property operators can be the same as expanded property separators
		 */

		const messageInvalidAny = "cannot contain operators or special symbols, but found"
		const messageInvalidBool = "cannot contain boolean operators or special symbols, but found"

		const invalidPrefixableString = opts.prefixableStrings?.find(val => all.includes(val))
		if (invalidPrefixableString) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: all, invalid: invalidPrefixableString },
			`prefixableStrings ${messageInvalidAny} "${invalidPrefixableString}"`,
			)
		}

		const invalidExpandedPropertySeparator = allKeywords
			.find(_ => _ === opts.expandedPropertySeparator as any)
		if (invalidExpandedPropertySeparator) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: allKeywords, invalid: invalidExpandedPropertySeparator },
			`expandedPropertySeparator ${messageInvalidBool} "${invalidExpandedPropertySeparator}"`,
			)
		}

		const invalidCustomPropertyOperator = opts.customPropertyOperators?.find(val => keywords.includes(val))
		? opts.expandedPropertySeparator
		: undefined
		if (invalidCustomPropertyOperator) {
			throw new ExpressitError(
				PARSER_ERROR.CONFLICTING_OPTIONS_ERROR,
				{ prohibited: keywords, invalid: invalidCustomPropertyOperator },
			`customPropertyOperator ${messageInvalidBool} "${invalidCustomPropertyOperator}"`,
			)
		}
		/* #regionend */
	}

	if (evaluatorChecks) {
		const requireCustomNormalizer: (keyof ParserOptions)[] = [] as any
		if ((opts.prefixableStrings?.length ?? 0) > 0) requireCustomNormalizer.push("prefixableStrings")
		if ((opts.customPropertyOperators?.length ?? 0) > 0) requireCustomNormalizer.push("customPropertyOperators")
		if ((opts.expandedPropertySeparator?.length ?? 0) > 0) requireCustomNormalizer.push("expandedPropertySeparator")
		if (opts.regexValues) requireCustomNormalizer.push("regexValues")

		if (requireCustomNormalizer.length > 0 && opts.conditionNormalizer === defaultConditionNormalizer) {
			throw new ExpressitError(
				PARSER_ERROR.OPTION_REQUIRED_ERROR,
				{ options: requireCustomNormalizer, requires: "conditionNormalizer" },
				`A custom conditionNormalizer function must be specified when using the following options: ${requireCustomNormalizer.join(", ")}`,
			)
		}
		const requireCustomComparer: (keyof ParserOptions)[] = [] as any
		if (opts.regexValues) requireCustomComparer.push("regexValues")
		if (opts.regexValues) requireCustomComparer.push("arrayValues")

		if (requireCustomComparer.length > 0 && opts.valueComparer === defaultValueComparer) {
			throw new ExpressitError(
				PARSER_ERROR.OPTION_REQUIRED_ERROR,
				{ options: requireCustomComparer, requires: "valueComparer" },
					`A custom valueComparer function must be specified when using the following options: ${requireCustomComparer.join(", ")}`,
			)
		}
	}
	if (validatorChecks) {
		if (opts.valueValidator === undefined) {
			throw new ExpressitError(
				PARSER_ERROR.OPTION_REQUIRED_ERROR,
				{ requires: "valueValidator" },
				`A custom valueValidator function must be specified when using the validate method.`,
			)
		}
	}
}

