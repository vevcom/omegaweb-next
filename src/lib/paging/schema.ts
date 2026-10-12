import { maxPageSize } from './constants'
import { z } from 'zod'

const pageSize = z.number().int().min(1).max(maxPageSize)

export function readPageInputSchema<Cursor, Details>(
    cursor: z.ZodType<Cursor>,
    details: z.ZodType<Details>,
) {
    const page = z.union([
        z.object({
            pageSize,
            page: z.number().int().min(0),
            cursor,
        }),
        z.object({
            pageSize,
            page: z.literal(0),
            cursor: z.literal(null),
        }),
    ]).refine(
        data => data.cursor !== null || data.page === 0,
        {
            message: 'With null as cursor, page must be 0.',
        },
    )

    return z.object({
        page,
        details,
    })
}

export function readPageInputSchemaObject<Cursor, Details>(
    cursor: z.ZodType<Cursor>,
    details: z.ZodType<Details>,
) {
    return z.object({
        paging: readPageInputSchema(cursor, details),
    })
}

/**
 * Infers the Cursor type out of a schema built by readPageInputSchemaObject, so that frontend
 * paging contexts do not need to hand-declare a Cursor type that has to be kept in sync manually.
 */
export type InferPagingCursor<Schema extends z.ZodTypeAny> =
    z.infer<Schema> extends { paging: { page: infer Page } }
        ? (Page extends { cursor: infer Cursor } ? Exclude<Cursor, null> : never)
        : never

/**
 * Infers the Details type out of a schema built by readPageInputSchemaObject, so that frontend
 * paging contexts do not need to hand-declare a Details type that has to be kept in sync manually.
 */
export type InferPagingDetails<Schema extends z.ZodTypeAny> =
    z.infer<Schema> extends { paging: { details?: infer Details } } ? Details : never
