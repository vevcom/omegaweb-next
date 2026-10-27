import { searchCategoryNames } from './constants'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    query: z.string().trim().max(100),
    limit: z.number().int().min(1)
        .optional(),
    category: z.enum(searchCategoryNames).optional(),
})

export const searchSchemas = {
    params: {
        /**
         * What the `search` operation of every service takes, through `implementSearchOperation`.
         * An empty query narrows nothing, so a page can pass its search box through as it is.
         */
        search: paramsFieldSchemas.pick({
            query: true,
            limit: true,
        }),
        // The global search has nothing to show without text to search for.
        searchAll: paramsFieldSchemas.pick({
            query: true,
            category: true,
        }).extend({
            query: paramsFieldSchemas.shape.query.min(1),
        }),
    },
}
