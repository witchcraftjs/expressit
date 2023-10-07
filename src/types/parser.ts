import type { DeepRequired, MakeRequired } from "@alanscodelog/utils"

import type { Position, TOKEN_TYPE } from "./ast.js"

import type { ArrayNode, Condition, ConditionNode, ValidToken, VariableNode } from "../ast/classes/index.js"


// #partially-synced
export type FullParserOptions<T extends {} = {}> = MakeRequired<
	ParserOptions<T>,
	// makes required all except:
	Exclude<keyof ParserOptions<T>,
		| "prefixableStrings"
		| "expandedPropertySeparator"
		| "customPropertyOperators"
		| "keywords"
	>
>
& {
	// overrides
	keywords: DeepRequired<KeywordOptions>
}
export type ParserOptions<T extends {} = {}> = {
	/**
	 * Allows any conditions (i.e. a variable or negated variable) to precede groups and append themselves to all variables inside them. Regular use of groups for changing precedence (e.g. `(a || b) && c` ) or negating expressions `!(a || b)` is still supported even if `prefixableGroups` is false.
	 *
	 * For example:
	 * ```js
	 * category.subcategory.(variable1 || variable2 && !variable3)
	 * ```
	 * returns an @see GroupNode whose prefix is a value token with the value `category.subcategory.`
	 *
	 * This prefix can later be applied by utility functions when evaluating the expression or extracting information from it. The default @see PrefixApplier appends the prefix name to every variable inside the group, so the above would expand into something like:
	 * ```js
	 * category.subcategory.variable1 || category.subcategory.variable2 || !category.subcategory.variable3
	 * ```
	 *
	 * @see UtilityOptions["prefixApplier"] for more examples and details on how to customize the behavior.
	 */
	prefixableGroups?: boolean
	/**
	 * If defined, allows the given "list" of unquoted "variables" to precede quoted ones, creating a prefixed string.
	 *
	 * This is useful for "tagging" strings so you can interpret them as something else. For example, you could have a string prefix, `num` for allowing users to pass strings that will be interpreted as numbers when you would normally not be able to tell if it's a number (e.g.`num"0.1"`, `num"1,000"`) .
	 *
	 * A known "list" is needed, otherwise, error handling is not as nice in some cases.
	 */
	prefixableStrings?: string[]
	/**
	 * Allows the use of expanded property condition operators in the form `prop[SEP]op[SEP]variable` or `prop[SEP]op(group)` where `SEP` is the given separator.
	 *
	 * It is not necessary to pass a list of operators, since only characters that match the unquoted variable rules can be used.
	 *
	 * For example, using `:`.
	 *
	 * ```js
	 * title:contains:value
	 * title:contains(value)
	 * ```
	 *
	 * The information for these types of conditions are stored in a @see ConditionNode 's `property`, `propertyOperator`, and `sep` properties.
	 *
	 * The separator can only be one character long and is added to the list of characters that need to be escaped.
	 *
	 * The property is always a @see VariableNode and can be a quoted variable, but it can never be a prefixed string (if using `prefixableStrings`).
	 * ```
	 */
	expandedPropertySeparator?: string
	/**
	 * Allows the use short property condition operators in the form `prop[OP]variable` or `prop[OP](group)`. Where `OP` is one the given operators.
	 *
	 * The operators can only be one or two characters long (with two character operators having priority), and they are added to the list of symbols that must be escaped.
	 *
	 * For example, allowing the use of `<`, `>`, etc.:
	 *
	 * ```js
	 * date>2020
	 * date=(2020 OR 2021)
	 * ```
	 * The same operator as the expanded property separator can be passed and it will take priority (e.g. `{expandedPropertySeparator: ":", customPropertyOperators:[":"]}`).
	 *
	 * For example, we might want `:` to mean `contains`:
	 *
	 * ```js
	 * title:(a OR b) // title:a OR title:B
	 * title:(a AND b) // title:a AND title:B
	 * ```
	 * Since these are just regular groups you can use them to allow making queries shorter:
	 * ```js
	 * // if onMissingBooleanOperator = "and"
	 * title:(a b) // title:a AND title:B
	 * // if prefixableGroups = true
	 * title:(prefix(a OR B)) // title:prefix.a OR title:prefix.b
	 * ```
	 *
	 * Like expanded property operators, these are stored in the @see ConditionNode 's `property`, `propertyOperator` properties. `sep` is not used, not even if the the same operator as the `expandedPropertySeparator` is used. This is what is meant by these types of operators taking priority. If used in this short style, it will always be interpreted as a `propertyOperator`.
	 *
	 */
	customPropertyOperators?: string[]
	/**
	 *
	 * Allows controlling what happens when a boolean operator is missing. `error` is the default, which will insert an error token (expecting any operator).
	 *
	 * If `and`, no error token is inserted, instead a zero length AND token is used for the operator.
	 * If `or`, no error token is inserted, instead a zero length OR token is used for the operator.
	 *
	 * Note that the invisible operator will still have it's precedence, so the ast will look different depending if you default to and than if you default to or.
	 *
	 * My suggestion is default to `and` if you want to default to something because:
	 *  - It's likely if the user is aware of this feature they will only use no-symbol + the opposite symbol. In which case, which looks clearer?
	 * 	```
	 * 		a b || c (defaulting to and)
	 * 		a b && c (defaulting to or)
	 * 	```
	 *  - If searching through a lot of data, evaluation of expressions will be faster since it encourages not using an operator, and therefore using `and` which will short circuit conditions earlier.
	 */
	onMissingBooleanOperator?: "error" | "and" | "or"
	/**
	 * Enables regex strings as values. The value is treated as if it was quoted by forward slashes. Any repetition of lowercase characters (even if there are multiple) attached to the end are assumed to be flags and added as a single token to the value's `quotes.mode` property.
	 *
	 * Can be passed a custom function to determine when to use the regex value or not (it is converted to a regular value). The function is passed the property, the operator, and whether it's an expanded operator. If their is an error token for the property or operator, an empty string is passed.
	 *
	 * ```ts
	 * // allow anything (`prop=/val/`, `prop:op:/val`, `prop=(/val/)`, `prop:op(/val/)`) but the value alone (`/regex/`)
	 * regexValues: (property, operator, isExpanded) => return property !== undefined || operator !== undefined
	 * // only allow for a certain custom operator (not expanded) (`prop=/val/` but not `prop:op:/val/` or `prop:op(/val/)`)
	 * regexValues: (property, operator, isExpanded) => return !isExpanded && operator === "="
	 * ```
	 *
	 * Notes:
	 *
	 * - Usually you should only actually allow `i`, `m`, and `u` since the others would make no sense for a query language and would bring down performance.
	 *
	 * - Unlike quoted values we can't fix errors like `... val/ ...`. If the `/` were a quote, we can tell a quote is missing before the val, but with regexes, it will just swallow ALL the input AFTER.
	 *
	 * There is also the following cases that might seem strange:
	 * ```
	 * ... /[/ ...
	 *     ^start .... no end
	 * ... /[/ ... /...../
	 *     ^       ^     ^
	 *     start   | end | start
	 *
	 * ```
	 * They *seem* to incorrectly swallow all input after or until the next `/`, but this is correct and happens because forward slashes do not need to be escaped inside regex sets (i.e. `[]`). And even if the regex is invalid and the set is never closed, we can't tell the set isn't closed when parsing. This is also why it would be very hard to create smarter errors like quoted values have.
	 */
	regexValues?: boolean | ((property: string | undefined, operator: string | undefined, isExpanded: boolean) => boolean)
	/**
	 * Enables array values, both alone, and for any property operators.
	 *
	 * Values need not be separated by anything except spaces and values inside follow the same rules as for any lone variables. They can be quoted and prefixed (if prefixableStrings is enabled). They cannot be regex values.
	 *
	 * Any operators, etc, are treated as values.
	 *
	 * While missing right parens can be detected, missing left ones cannot. Input like `a && val]` is interpreted as `"a" && "val]"`.
	 */
	arrayValues?: boolean | ((property: string | undefined, operator: string | undefined, isExpanded: boolean) => boolean)
	/**
	 * An object where each of the the three keys (or/and/not) contains a list of keyword operator entries.
	 *
	 * If nothing is passed, the following defaults are used:
	 *
	 * ```ts
	 * keywords: {
	 * 	or: [
	 * 		{ value: "||", isSymbol: true },
	 * 		{ value: "|", isSymbol: true },
	 * 		{ value: "or", isSymbol: false },
	 * 		{ value: "OR", isSymbol: false },
	 * 	],
	 * 	and: [
	 * 		{ value: "&&", isSymbol: true },
	 * 		{ value: "&", isSymbol: true },
	 * 		{ value: "and", isSymbol: false },
	 * 		{ value: "AND", isSymbol: false },
	 * 	],
	 *		not: [
	 * 		{ value: "!", isSymbol: true },
	 * 		{ value: "not", isSymbol: false },
	 * 		{ value: "NOT", isSymbol: false },
	 * 	],
	 * }
	 * ```
	 *
	 * `isSymbol` just tells the parser to treat the value as a symbol, not necessarily that it *is* a symbol (the parser make no distinction between character types). For example, you could pass `{ value: "and", isSymbol: true }`, but this would cause just `and` to require quoting or escaping to be parsed as a variable, and values like `andromeda` to be parsed as `and romeda`.
	 *
	 * You might think this means something similar to not requiring whitespace, but it's not. The parser is as lenient as possible and even if `isSymbol` is false, there are cases where whitespace is not needed because it is clear the keyword is not part of a value, (e.g. `not(a)`).
	 */
	keywords?: KeywordOptions
	/**
	 * If prefixableGroups is true, this allows you to control how a prefix is applied for any methods that need to apply them (e.g. @see extractVariables @see evaluate).
	 *
	 * The default @see PrefixApplier function just appends the prefix.
	 *
	 * So for example:
	 *
	 * ```js
	 * category.subcategory.(variable1 || variable2)
	 * // = category.subcategory.variable1 || category.subcategory.variable2
	 *
	 * "category subcategory "(variable1 || variable2)
	 * // = "category subcategory variable1" || "category subcategory variable2"
	 *
	 * // negations also work:
	 * !category.(subcategory.(variable1 || !variable2))
	 * // = !category.subcategory.variable1 || category.subcategory.variable2
	 *```
	 *
	 * But, for example, you might want to be less strict and allow things like `prefix(var)` to get converted to `prefix.var` instead of `prefixvar`. To do so, you can pass a function like this one.
	 *
	 * ```ts
	 * {
	 * 	// ...
	 * 	prefixableGroups: true,
	 * 	prefixApplier: (prefix:string, variable: string) => {
	 * 		if (!prefix.endsWith(".")) {
	 * 			return `${prefix}.${variable}`
	 * 		}
	 * 		return prefix + variable
	 * 	}
	 * 	// ...
	 * }
	 * ```
	 */
	prefixApplier?: PrefixApplier
	/**
	 * The {@link ParserOption.prefixApplier} can only apply prefixes and cannot tell us how to get the value from a context object when using {@link evaluate}.
	 *
	 * This functions tells us how to actually interpret the key to be able to get it from the context. It is passed the result of the prefixApplier and should return an array of keys.
	 *
	 * The default parser only returns the value wrapped in an array.
	 *
	 * So for example, given `"category.subcategory.variable"`, it would return `["category.subcategory.variable"]` and require the context object to look like:
	 * ```ts
	 * {
	 * 	"category.subcategory.variable1" : //value
	 * }
	 * ```
	 *
	 * If your context object contains nested values, you would need to specify a function that returns the keys needed to access the value in an array. For example:
	 * ```ts
	 * // context
	 * {
	 * 	category: {
	 * 		subcategory: {
	 * 			variable: //value
	 * 		}
	 * 	}
	 * }
	 * // given:
	 * "category.subcategory.variable"
	 * // we can use a getter like:
	 *
	 * {
	 * 	//...
	 * 	keyParser: (key:string) => key.split(".")
	 * 	//...
	 * }
	 * // which would return:
	 * ["category", "subcategory", "variable"]
	 *
	 * ```
	 */
	keyParser?: KeyParser
	/**
	 * When evaluating an ast against a context, this function determines whether a context value satisfies a condition.
	 *
	 * Given a partial {@link Condition} instance (negate property is not passed) and the contextValue (as extracted using {@link Condition.property}), it should return whether the values are equal.
	 *
	 * It is also passed the context itself for cases where there is no property and you might want to check the value against all properties of the context.
	 *
	 * A default comparer is available but it just checks the context value against the query value for strict equality.
	 *
	 * ```ts
	 * type Operators = "contains"
	 * function valueComparer(condition: Omit<Condition, "negate">, contextValue: any, context: any): boolean {
	 * 	switch (operator as Operators) {
	 * 		case "contains": return (contextValue as string[]).includes(condition.value as string)
	 * 		// ...
	 * 	}
	 * 	if (condition.property.length === 0) {
	 * 		// no property was given, contextValue is always undefined
	 * 		// attempt to match against all properties
	 * 		return Object.values(context).find(anyContextValue => anyContextValue.match(condition.value) !== undefined) !== undefined
	 * 	}
	 * }
	 * ```
	 */
	valueComparer?: ValueComparer
	/**
	 * When {@link Parser.normalize normalizing} an ast, this function is needed to determine what exactly the value and operator of the condition is and whether it should be negated when evaluating.
	 *
	 * Given a query object it should return the values of the `value`, `operator`, and `negate` properties that will be assigned to {@link Condition}.
	 *
	 * You can think of the query object as a simplified version of the condition node. See {@link ValueQuery} for details on each property.
	 *
	 * A default function is available, but it just sets the value to the query value, ignoring everything else.
	 *
	 * Example of how you might approach writing a function that handles all the different parser features (groups, prefixed strings, etc):
	 *
	 * ```ts
	 * type RawOperators = ">" | "contains" | // operator types (expanded vs custom) are not distinguished from each other
	 * type RawPrefixes = "num"
	 * type Operators = "contains"
	 *
	 * function conditionNormalizer({ operator, prefix, value, regexFlags, isRegex, isExpanded, isNegated, isQuoted }: ValueQuery): {value:any, operator: Operators} {
	 * 	let finalValue: any = value
	 * 	let finalOperator: any = operator
	 * 	if (prefix) {
	 * 		const val = value as string // it's always a string if prefixed
	 * 		switch (prefix as RawPrefixes) {
	 * 			case "num": finalValue = parseInt(val, 2); break
	 * 			// ...
	 * 		}
	 * 	}
	 * 	// another way to allow special unquoted value types is something like this:
	 * 	if (typeof value === "string" && !isQuoted) {
	 * 		const asNum = parseInt(value, 2)
	 * 		if (!isNaN(asNum)) finalValue = asNum
	 * 		if (["true","false"].includes(value)) {
	 * 			finalValue = value === "true" ? true : false
	 * 		}
	 * 	}
	 * 	if (isRegex) {
	 * 		const val = value as string // it's always a string and never prefixed if it's a regex
	 * 		const regex = new RegExp(val, regexFlags) // this can throw if the user passes invalid flags
	 * 		finalValue = regex
	 * 	}
	 * 	if (operator) {
	 * 		switch (operator as RawOperators) {
	 * 			case ">": {
	 * 				finalOperator = "contains"
	 * 				break
	 * 			}
	 * 			case "contains": {
	 * 				finalOperator = "contains"
	 * 				break
	 * 			}
	 * 		}
	 * 	}
	 * 	return {value: finalValue, operator: finalOperator, negate: isNegated }
	 * }
	 * ```
	 * In this example, nothing was done with `isNegated`, but there are cases where you might need to change it. For example, you could choose to convert certain operators to others to reduce the number of operators you have to implement (e.g. convert all `lt/e` to `gt/e` to only have to implement `gt/e`). When you invert such operators, you also have to invert `isNegated`.
	 */
	conditionNormalizer?: ConditionNormalizer
	/**
	 * Similar to the valueComparer but for validating the ast before it's evaluated using @see Parser["validate"] (e.g. for syntax highlighting purposes). For the moment the ast must be valid (without syntax errors) to be validated.
	 *
	 * The only difference is nothing is actually evaluated (even though the values are available to the function\*) and the query contains the actual nodes/tokens for certain properties to make extracting positions easier.
	 *
	 * The function should return any positions of interest. These are collected and are returned as the result of the validate method. Basically it makes it easy to "tag" ranges. You're not restricted to returning just the position and you can use the generic argument to type additional properties you might return.
	 *
	 * \* The validate function won't attempt to fetch context values if no context is passed to the validate method (in which case the contextValue parameter will just be undefined).
	 *
	 * Example:
	 * Say we had a context that had a single nested key `a.b.c.d.e`.
	 *
	 * If a user inputs `a(c(d)) || e` we want to highlight all the prefixes from the first invalid "branch" (`c`). In the case of this input, the validator function is called for each innermost value (so twice, once for `d` and once for `e`).
	 *
	 * The first time (for `d`), the validator would receive a query whose `property` property would contain an array like: `[ValidToken(a), ValidToken(c), ValidToken(d)]`. We can do something like the following to "tag" `c` as the root of the problem, `d` as a sort of continuation of that error.
	 *
	 * Then the second time we will receive `[ValidToken(e)]`, which we can "tag" as some other error.
	 *
	 * ```ts
	 * valueValidator(_contextValue, query, context) {
	 * 	const values = query.propertyKeys
	 * 	let i = 1
	 * 	// where `get` is something like lodash's get
	 * 	while (i < query.property.length && get(context, values.slice(0, i)) !== undefined) {
	 * 		i++
	 * 	}
	 * 	if (i !== 0) {
	 * 		const invalid = query.property.slice(i - 1, query.property.length)
	 * 			.map(node => ({
	 * 				// use the node position to include any quotes in the position
	 * 				start: node.start,
	 * 				end: node.end,
	 * 				type: "InvalidPrefix",
	 * 			}))
	 * 			invalid[0].type = query.property.length === 1 ? "InvalidVariable" : "InvalidPrefixBranch"
	 * 		return invalid
	 * 	}
	 * }
	 * // ...later
	 * // context could be a dummy context where all known properties are just true
	 * const errors => parser.validate(ast, context)
	 * // ... use the information to highlight those locations accordingly
	 * // a(c(d || e))
	 * //          ^InvalidVariable
	 * //     ^InvalidPrefix
	 * //   ^InvalidPrefixBranch
	 * ```
	 */
	valueValidator?: ValueValidator<T>

}

/** {@link ParserOptions.conditionNormalizer} */
export type ValueQuery
	// <
	// TPrefixed extends string | undefined = string | undefined,
	// TRegex extends boolean = boolean,
	//	todo not sure why this isn't working for value
	// 	TPrefixed extends string
	// 	? string
	// 	: TRegex extends true
	// 	? true
	// 	: true | string | string[]
	// >
	= {
		condition: ConditionNode
		/**
		 * The raw condition node from which the query is constructed. Should not really be needed but is available just in case. If using it instead of the constructed query, **do not take it's operator (negation) into account**, {@link ParserOptions.conditionNormalizer}
		 */
		/** The property operator if one was used. */
		operator: string | undefined
		/** The value prefix (if a prefixable string was used for the value). If this is defined, the value is always a string. */
		prefix: string | undefined
		/**
		 * Contains the value (unescaping is already taken care of) being queried for.
		 *
		 * If no property operator was used (e.g. input like just `a`), it is always `true` since negations are handled separately.
		 *
		 * If `prefix` is defined or `isRegex` is true, this is always a string.
		 *
		 * There's two cases where this might be an array, isArray is true, OR, the user
		 */
		value: true | string | string[]
		/**
		 * Contains the parsed property name as parsed by {@link ParserOptions.keyParser}.
		 */
		property?: string[]
		/** If the value is a regex, any flags that were used. */
		regexFlags?: string
		/** Whether the value should be interpreted as a regex. If this is true, the value is always a string. */
		isRegex: boolean
		/** If the value was quoted (is not true if the value is a regex although regexes are technically a quote type). */
		isQuoted: boolean
		/** If condition is negated. Takes into account parent expression, groups, etc, so can be different than the operator of the raw condition. */
		isNegated: boolean
		/** If the operator is an expanded operator. */
		isExpanded: boolean
	}

/** @see ParserOptions["valueValidator"] */
export type ValidationQuery = Omit<ValueQuery, "value" | "operator" | "prefix" | "regexFlags" | "property"> & {
	value?: VariableNode | ArrayNode
	operator?: ValidToken<TOKEN_TYPE.VALUE | TOKEN_TYPE.OP_CUSTOM>
	prefix?: ValidToken<TOKEN_TYPE.VALUE>
	regexFlags?: ValidToken<TOKEN_TYPE.VALUE>
	property: VariableNode[]
	/** The property as would be passed to the @see ParserOptions["valueComparer"] function (i.e. joined as a string using the @see ParseOptions["prefixApplier"] ) */
	propertyName?: string
	/** The property keys, as parsed by @see ParserOptions["keysParser"] */
	propertyKeys: string[]
	/**
	 * Contains a list of all the wrapping group prefix nodes.
	 */
	prefixes?: VariableNode[]
}
export type ValueComparer = (condition: Omit<Condition, "negate">, contextValue: any, context: any) => boolean
export type ConditionNormalizer = (query: ValueQuery) => { value: any, operator: any, negate: boolean }
export type ValueValidator<T = Record<string, any>> = (contextValue: any | undefined, query: ValidationQuery, context?: Record<string, any>) => (Position & T)[] | undefined | void
// export type PrefixValidator<T> = (prefixes: VariableNode[], last: VariableNode) => (Position & T)[]
export type KeyParser = (key: string) => string[]
export type PrefixApplier = (prefix: string, variable: string) => string

export type KeywordEntry = {
	/** See @see ParserOptions["KeywordOptions"] */
	isSymbol: boolean
	value: string
}
export type KeywordOptions = {
	or?: KeywordEntry[]
	and?: KeywordEntry[]
	not?: KeywordEntry[]
}

