import { parseData } from '@/services/parseData'
import type { FormValues } from './formStore'
import type { ErrorMessage } from '@/services/error'
import type { z } from 'zod'

/**
 * The issues that stand in the way of submitting the values of a form: those its data schema has
 * with them, parsed as the operation parses them.
 *
 * zod strips a key an object schema lacks, so a field with a misspelt name would be dropped
 * without a word. In development such a field is an issue too, once the schema has none.
 */
export function checkValues(dataSchema: z.ZodTypeAny, values: FormValues): ErrorMessage[] {
    const parsed = parseData(dataSchema, values)
    if (!parsed.success) return parsed.error.issues
    if (process.env.NODE_ENV === 'production') return []

    const known: unknown = parsed.data
    if (typeof known !== 'object' || known === null || Array.isArray(known)) return []
    return Object.entries(values)
        .filter(([name, value]) => value !== undefined && !(name in known))
        .map(([name]) => ({ path: [name], message: `Dataskjemaet har ikke feltet «${name}».` }))
}
