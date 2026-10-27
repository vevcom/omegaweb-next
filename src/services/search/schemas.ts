import { searchCategoryNames } from './constants'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    query: z.string().trim().min(1).max(100),
    limit: z.number().int().min(1).max(25)
        .optional(),
    category: z.enum(searchCategoryNames).optional(),
})

/**
 * Every service's own `search` operation picks `query` and `limit` from here, so the rules are the
 * same in all of them.
 */
export const searchParamsFieldSchemas = paramsFieldSchemas

export const searchSchemas = {
    params: {
        search: paramsFieldSchemas.pick({
            query: true,
            category: true,
        }),
    },
}
