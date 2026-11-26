import { zfd } from 'zod-form-data'
import type { z } from 'zod'

/**
 * How the data of an operation is parsed. The operation parses with it on the server and a form
 * with it in the browser, so the two cannot parse differently. It takes a `FormData` as well as
 * a plain object.
 */
export function parseData<DataSchema extends z.ZodTypeAny>(dataSchema: DataSchema, data: unknown) {
    return zfd.formData(dataSchema).safeParse(data)
}
