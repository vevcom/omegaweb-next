import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import tsNextRules from 'eslint-config-next/typescript'
import tsConfigs from 'typescript-eslint'
import checkFile from 'eslint-plugin-check-file'

// Next.js app-router special filenames are framework-fixed, so they're excluded from the
// naming-convention rules below instead of flagged as violations.
const nextSpecialFilenames = '!(page|layout|template|default|loading|error|global-error|not-found)'

const eslintConfig = defineConfig([
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsConfigs.parser,
            parserOptions: {
                projectService: true,
            },
        },
        plugins: {
            '@typescript-eslint': tsConfigs.plugin,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
            },
        },
        extends: [
            tsConfigs.configs.recommendedTypeChecked,
            tsConfigs.configs.stylisticTypeChecked,
            nextVitals,
            tsNextRules,
        ],
        rules: {
            indent: [
                'error',
                4,
                {
                    SwitchCase: 1,
                    VariableDeclarator: 1
                }
            ],
            // require function expressions to have a name
            'func-names': 'warn',
            // enforce newline at the end of file, with no multiple empty lines
            'eol-last': 'error',
            // disallow padding inside computed properties, ie. obj[ "fjie"] not allowed
            'computed-property-spacing': [
                'error',
                'never'
            ],
            // Allow the use of namespaces
            '@typescript-eslint/no-namespace': 'off',
            // suggest using arrow functions as callbacks
            'prefer-arrow-callback': 'error',
            // suggest using template literals instead of string concatenation
            'prefer-template': 'error',
            // disallow modifying variables that are declared using const
            'no-const-assign': 'error',
            // disallow symbol constructor
            'no-new-symbol': 'error',
            // disallow to use this/super before super() calling in constructors.
            'no-this-before-super': 'error',
            // require let or const instead of var
            'no-var': 'error',
            // disallow unnecessary constructor
            'no-useless-constructor': 'error',
            // require method and property shorthand syntax for object literals
            // ie write obj = { x }, not obj = {x: x}
            'object-shorthand': [
                'error',
                'always'
            ],
            // disallow deletion of variables
            'no-delete-var': 'error',
            // disallow labels that share a name with a variable
            'no-label-var': 'error',
            // disallow self assignment
            'no-self-assign': 'error',
            // disallow shadowing of names such as arguments
            'no-shadow-restricted-names': 'error',
            // disallow declaration of variables already declared in the outer scope
            'no-shadow': 'error',
            // disallow use of undeclared variables unless mentioned in a /*global */ block
            'no-undef': 'error',
            // disallow use of variables before they are defined
            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                    classes: false,
                    variables: true,
                    typedefs: false
                }
            ],
            // enforces no braces where they can be omitted
            'arrow-body-style': [
                'error',
                'as-needed'
            ],
            // require space before/after arrow function"s arrow
            'arrow-spacing': [
                'error',
                {
                    before: true,
                    after: true
                }
            ],
            // verify super() callings in constructors
            'constructor-super': 'error',
            // disallow modifying variables of class declarations
            'no-class-assign': 'error',
            // disallow arrow functions where they could be confused with comparisons
            'no-confusing-arrow': [
                'error',
                {
                    allowParens: true
                }
            ],
            // Require or disallow spaces before/after unary operators
            'space-unary-ops': [
                'error',
                {
                    words: true,
                    nonwords: false
                }
            ],
            quotes: [
                'error',
                'single',
                'avoid-escape'
            ],
            'jsx-quotes': ['error', 'prefer-double'],
            // require camel case names
            camelcase: [
                'error',
                {
                    properties: 'never'
                }
            ],
            // enforce spacing before and after comma
            'comma-spacing': [
                'error',
                {
                    before: false,
                    after: true
                }
            ],
            // enforce one true comma style
            'comma-style': [
                'error',
                'last'
            ],
            'key-spacing': [
                'error',
                {
                    beforeColon: false,
                    afterColon: true
                }
            ],
            // require a space before & after certain keywords
            'keyword-spacing': [
                'error',
                {
                    before: true,
                    after: true,
                    overrides: {
                        return: { after: true },
                        throw: { after: true },
                        case: { after: true }
                    }
                }
            ],
            // disallow mixed "LF" and "CRLF" as linebreaks
            'linebreak-style': [
                'error',
                'unix'
            ],
            // specify the maximum depth callbacks can be nested
            'max-nested-callbacks': [
                'error',
                4
            ],
            // disallow the omission of parentheses when invoking a constructor with no arguments
            'new-parens': 'error',
            // enforces new line after each method call in the chain to make it
            // more readable and easy to maintain
            'newline-per-chained-call': [
                'error',
                {
                    ignoreChainWithDepth: 4
                }
            ],
            // disallow use of the Array constructor
            'no-array-constructor': 'error',
            // disallow use of the continue statement
            // "no-continue": "warn",
            // disallow if as the only statement in an else block
            'no-lonely-if': 'error',
            // disallow mixed spaces and tabs for indentation
            'no-mixed-spaces-and-tabs': 'error',
            // disallow multiple empty lines and only one newline at the end
            'no-multiple-empty-lines': [
                'error',
                {
                    max: 2,
                    maxEOF: 1
                }
            ],
            // disallow nested ternary expressions
            'no-nested-ternary': 'error',
            // disallow use of the Object constructor
            'no-new-object': 'error',
            // disallow trailing whitespace at the end of lines
            'no-trailing-spaces': 'error',
            // disallow the use of Boolean literals in conditional expressions
            // also, prefer `a || b` over `a ? a : b`
            'no-unneeded-ternary': [
                'error',
                {
                    defaultAssignment: true
                }
            ],
            // disallow whitespace before properties
            'no-whitespace-before-property': 'error',
            // require padding inside curly braces
            'object-curly-spacing': [
                'error',
                'always'
            ],
            // require a newline around variable declaration
            'one-var-declaration-per-line': [
                'error',
                'always'
            ],
            // enforce padding within blocks
            'padded-blocks': [
                'error',
                'never'
            ],
            // require quotes around object literal property names
            'quote-props': [
                'warn',
                'as-needed',
                {
                    keywords: false,
                    unnecessary: true,
                    numbers: false
                }
            ],
            // specify whether double or single quotes should be used
            // require or disallow use of semicolons instead of ASI
            semi: [
                'error',
                'never'
            ],
            // require or disallow space before blocks
            'space-before-blocks': 'error',
            // require or disallow space before function opening parenthesis
            'space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    named: 'never'
                }
            ],
            // require or disallow spaces inside parentheses
            'space-in-parens': [
                'error',
                'never'
            ],
            // require spaces around operators
            'space-infix-ops': 'error',
            // enforces return statements in callbacks of array"s methods
            'array-callback-return': 'error',
            // require return statements to either always or never specify values
            'consistent-return': 'error',
            // specify curly brace conventions for all control statements
            curly: [
                'error',
                'multi-line'
            ],
            // require default case in switch statements
            'default-case': 'error',
            // encourages use of dot notation whenever possible
            'dot-notation': 'error',
            // require the use of === and !==
            eqeqeq: 'error',
            // make sure for-in loops have an if statement
            'guard-for-in': 'error',
            // disallow the use of alert, confirm, and prompt
            'no-alert': 'warn',
            // disallow use of arguments.caller or arguments.callee
            'no-caller': 'error',
            // disallow lexical declarations in case/default clauses
            'no-case-declarations': 'error',
            // disallow else after a return in an if
            'no-else-return': 'error',
            // disallow Unnecessary Labels
            'no-extra-label': 'error',
            // disallow comparisons to null without a type-checking operator
            'no-eq-null': 'error',
            // disallow use of eval()
            'no-eval': 'error',
            // disallow adding to native types
            'no-extend-native': 'error',
            // disallow unnecessary function binding
            'no-extra-bind': 'error',
            // disallow fallthrough of case statements
            'no-fallthrough': 'error',
            // disallow the use of leading or trailing decimal points in numeric literals
            'no-floating-decimal': 'error',
            // disallow use of eval()-like methods
            'no-implied-eval': 'error',
            // disallow this keywords outside of classes or class-like objects
            'no-iterator': 'error',
            // disallow use of labels for anything other then loops and switches
            'no-labels': [
                'error',
                {
                    allowLoop: false,
                    allowSwitch: false
                }
            ],
            // disallow unnecessary nested blocks
            'no-lone-blocks': 'error',
            // disallow creation of functions within loops
            'no-loop-func': 'error',
            // disallow use of multiple spaces
            'no-multi-spaces': 'error',
            // disallow use of multiline strings
            'no-multi-str': 'error',
            // disallow reassignments of native objects
            'no-native-reassign': 'error',
            // disallow use of new operator when not part of the assignment or comparison
            'no-new': 'error',
            // disallow use of new operator for Function object
            'no-new-func': 'error',
            // disallows creating new instances of String,Number, and Boolean
            'no-new-wrappers': 'error',
            // disallow use of (old style) octal literals
            'no-octal': 'error',
            // disallow use of octal escape sequences in string literals, such as
            // var foo = "Copyright \251";
            'no-octal-escape': 'error',
            // disallow reassignment of function parameters
            // disallow parameter object manipulation
            'no-param-reassign': [
                'warn',
                {
                    props: false
                }
            ],
            // disallow usage of __proto__ property
            'no-proto': 'error',
            // disallow use of assignment in return statement
            'no-return-assign': 'error',
            // disallow use of `javascript:` urls.
            'no-script-url': 'error',
            // disallow comparisons where both sides are exactly the same
            'no-self-compare': 'error',
            // disallow use of comma operator
            'no-sequences': 'error',
            // disallow usage of expressions in statement position
            'no-unused-expressions': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            // disallow unused labels
            'no-unused-labels': 'error',
            // disallow usage of configurable warning terms in comments: e.g. todo
            'no-warning-comments': [
                'warn',
                {
                    terms: ['todo', 'fixme', 'xxx'],
                    location: 'start'
                }
            ],
            // disallow use of the with statement
            'no-with': 'error',
            // require use of the second argument for parseInt()
            radix: 'error',
            // require immediate function invocation to be wrapped in parentheses
            'wrap-iife': [
                'error',
                'outside'
            ],
            // require or disallow Yoda conditions
            yoda: 'error',
            // disallow assignment in conditional expressions
            'no-cond-assign': [
                'error',
                'always'
            ],
            // disallow use of constant expressions in conditions
            'no-constant-condition': 'warn',
            // disallow control characters in regular expressions
            'no-control-regex': 'error',
            // disallow use of debugger
            'no-debugger': 'warn',
            // disallow duplicate arguments in functions
            'no-dupe-args': 'error',
            // disallow duplicate keys when creating object literals
            'no-dupe-keys': 'error',
            // disallow a duplicate case label.
            'no-duplicate-case': 'error',
            // disallow the use of empty character classes in regular expressions
            'no-empty-character-class': 'error',
            // disallow empty statements
            'no-empty': 'error',
            // disallow assigning to the exception in a catch block
            'no-ex-assign': 'error',
            // disallow double-negation boolean casts in a boolean context
            'no-extra-boolean-cast': 'error',
            // disallow unnecessary parentheses
            'no-extra-parens': [
                'error',
                'functions'
            ],
            // disallow unnecessary semicolons
            'no-extra-semi': 'error',
            // disallow overwriting functions written as function declarations
            'no-func-assign': 'error',
            // disallow function or variable declarations in nested blocks
            'no-inner-declarations': 'error',
            // disallow invalid regular expression strings in the RegExp constructor
            'no-invalid-regexp': 'error',
            // disallow irregular whitespace outside of strings and comments
            'no-irregular-whitespace': 'error',
            // disallow negation of the left operand of an in expression
            'no-negated-in-lhs': 'error',
            // disallow the use of object properties of the global object (Math and JSON) as functions
            'no-obj-calls': 'error',
            // disallow multiple spaces in a regular expression literal
            'no-regex-spaces': 'error',
            // disallow sparse arrays
            'no-sparse-arrays': 'error',
            // disallow unreachable statements after a return, throw, continue, or break statement
            'no-unreachable': 'error',
            // disallow comparisons with the value NaN
            'use-isnan': 'error',
            // ensure that the results of typeof are compared against a valid string
            'valid-typeof': 'error',
            // Avoid code that looks like two expressions but is actually one
            'no-unexpected-multiline': 'error',
            // specify the maximum depth that blocks can be nested
            'max-depth': [
                'error',
                4
            ],
            // limits the number of parameters that can be used in the function declaration.
            'max-params': [
                'error',
                5
            ],
            // disallow use of bitwise operators
            'no-bitwise': 'warn',
            // enforce return after a callback
            'callback-return': 'error',
            // enforces error handling in callbacks (node environment)
            'handle-callback-err': 'error',
            // disallow mixing regular variable and require declarations
            'no-mixed-requires': [
                'error',
                {
                    grouping: true,
                    allowCall: true
                }
            ],
            // disallow use of new operator with the require function
            'no-new-require': 'error',
            // disallow string concatenation with __dirname and __filename
            'no-path-concat': 'error',
            // disallow process.exit()
            'no-process-exit': 'error',
            // disallow use of synchronous methods (off by default)
            'no-sync': 'error',
            // enforce spacing inside array brackets
            'array-bracket-spacing': [
                'error',
                'never'
            ],
            // enforce one true brace style
            'brace-style': [
                'error',
                '1tbs',
                {
                    allowSingleLine: true
                }
            ],
            // enforce max length of lines
            'max-len': [
                'error',
                {
                    code: 125
                }
            ],
            // dissallow relative imports (e.g. '../'), imports from same folder are stil allowed
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['../'],
                            message: 'Relative imports are not allowed.'
                        }
                    ]
                }
            ],
            // import statement order
            'import/order': [
                'warn',
                {
                    groups: [
                        'index',
                        'sibling',
                        'parent',
                        'internal',
                        'external',
                        'builtin',
                        'object',
                        'type'
                    ]
                }
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports'
                }
            ],
            //SOME ODD OPTIONS:
            // suggest using the spread operator instead of .apply()
            'prefer-spread': 'error',
            // suggest using Reflect methods where applicable
            'prefer-reflect': 'error',
            // use rest parameters instead of arguments
            'prefer-rest-params': 'error',
            // enforce usage of spacing in template strings
            'template-curly-spacing': 'error',
            // disable next js warning for using <img>
            '@next/next/no-img-element': 'off',
            'id-length': [
                'error',
                {
                    exceptions: ['i', 'j', 'k', 'a', 'b', 'x', 'y', 'e', '_'],
                    min: 2
                }
            ],
            // we use types in stead of interfaces
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        }
    },
    {
        // Visible <input> elements should go through a component in @/components/UI
        // (TextInput, Checkbox, NumberInput, ...) rather than being written raw, so they get
        // consistent styling/behavior (e.g. Checkbox's hidden "field present" input keeps
        // unchecked boxes submitting correctly). type="hidden" inputs are exempt since they're
        // just plain form data carriers with no component equivalent. The UI folder itself is
        // exempt since that's where these primitives are implemented.
        files: ['src/app/**/*.tsx'],
        ignores: ['src/app/_components/UI/**'],
        rules: {
            'no-restricted-syntax': [
                'warn',
                {
                    selector: "JSXOpeningElement[name.name='input']"
                        + ":not(:has(JSXAttribute[name.name='type'] Literal[value='hidden']))",
                    message: 'Use an input component from @/components/UI (TextInput, Checkbox, NumberInput, '
                        + 'etc.) instead of a raw <input>. type="hidden" inputs are exempt.'
                }
            ]
        }
    },
    {
        // Lets check-file's filename rules run on non-JS files, which ESLint otherwise skips
        files: ['src/app/**/*.module.scss', 'src/prisma/schema/**/*.prisma'],
        plugins: { 'check-file': checkFile },
        processor: 'check-file/eslint-processor-check-file',
    },
    {
        // File and folder naming conventions, by area of the codebase.
        plugins: { 'check-file': checkFile },
        files: [
            'src/app/**/*',
            'src/services/**/*',
            'src/hooks/**/*',
            'src/contexts/**/*',
            'src/lib/**/*',
            'tests/**/*',
            'src/prisma/schema/**/*',
        ],
        rules: {
            'check-file/filename-naming-convention': [
                'error',
                // TODO: drop the ConfigVars and Validation exclusions below
                // once those files are renamed or removed.
                {
                    [`src/app/**/${nextSpecialFilenames}.tsx`]: 'PASCAL_CASE',
                    'src/app/**/!(route|manifest|sitemap|robots|ConfigVars).ts': 'CAMEL_CASE',
                    [`src/app/**/${nextSpecialFilenames}.module.scss`]: 'PASCAL_CASE',
                    'src/services/**/!(ConfigVars|Validation).ts': 'CAMEL_CASE',
                    'src/hooks/**/*.ts': 'CAMEL_CASE',
                    'src/contexts/**/*.tsx': 'PASCAL_CASE',
                    'src/lib/**/!(ConfigVars|pn-server-only).{ts,tsx}': 'CAMEL_CASE',
                    'tests/**/*.test.ts': 'CAMEL_CASE',
                    'src/prisma/schema/**/*.prisma': 'CAMEL_CASE',
                },
                { ignoreMiddleExtensions: true },
            ],
            'check-file/folder-naming-convention': [
                'error',
                {
                    'src/app/_components/**/': 'PASCAL_CASE',
                    'src/app/!(_components)/**/': 'NEXT_JS_APP_ROUTER_CASE',
                    'src/services/**/': 'CAMEL_CASE',
                    'src/contexts/**/': 'CAMEL_CASE',
                    'src/lib/**/': 'CAMEL_CASE',
                },
            ],
        },
    },
    {
        // Date/time fields (day, month, hour, ...) are only ever safe to read or construct through
        // an explicitly-zoned formatter. Reading/constructing them any other way silently depends on
        // the host's local timezone - UTC on the server, the visitor's own zone in the browser -
        // which is how B18 (toLocalDate/getOsloTime) and a string of other DST bugs happened.
        files: ['**/*.{ts,tsx}'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "NewExpression[callee.name='Date'][arguments.length>1]",
                    message: 'Never build a Date from individual fields (year, month, day, ...) - they are '
                        + 'read in the host\'s local timezone. Use an ISO string, Date.UTC(...), instant '
                        + 'arithmetic (Date.now() + ms), or Luxon\'s DateTime with an explicit zone instead.'
                },
                {
                    selector: 'CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/]'
                        + ":not(:has(Property[key.name='timeZone']))",
                    message: 'Pass an explicit timeZone (normally \'Europe/Oslo\') - formatting without one '
                        + 'depends on the host\'s local timezone and differs between server and client.'
                }
            ]
        }
    },
    {
        // The service/lib layer must only ever reason about real instants, never host-local
        // calendar/clock fields - see the rule above for why. displayDefaultInputValue.ts is the one
        // sanctioned exception: HTML date/datetime-local inputs are inherently browser-local.
        files: ['src/services/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
        ignores: ['src/lib/dates/displayDefaultInputValue.ts'],
        rules: {
            'no-restricted-properties': [
                'error',
                { property: 'getDate', message: 'Host-local getter - use getUTCDate or an explicitly-zoned formatter.' },
                { property: 'getMonth', message: 'Host-local getter - use getUTCMonth or an explicitly-zoned formatter.' },
                { property: 'getFullYear', message: 'Host-local getter - use getUTCFullYear or a zoned formatter.' },
                { property: 'getHours', message: 'Host-local getter - use getUTCHours or an explicitly-zoned formatter.' },
                { property: 'getMinutes', message: 'Host-local getter - use getUTCMinutes or a zoned formatter.' },
                { property: 'getSeconds', message: 'Host-local getter - use getUTCSeconds or a zoned formatter.' },
                { property: 'getDay', message: 'Host-local getter - use getUTCDay or an explicitly-zoned formatter.' }
            ]
        }
    },
    {
        // Module augmentation (e.g. next-auth) relies on interface declaration merging
        files: ['**/*.d.ts'],
        rules: {
            '@typescript-eslint/consistent-type-definitions': 'off',
        },
    },
    globalIgnores([
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
        'pncli/**',
        'docs/**',
        'generated/**',
        '.design-sync/.cache/**',
        'ds-bundle/**',
    ]),
])

export default eslintConfig
