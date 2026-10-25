import { FIELD_IS_PRESENT_VALUE } from './constants'
import { dateMatchCron } from '@/lib/dates/cron'
import { z } from 'zod'
import { zfd } from 'zod-form-data'
import type { EnumLike } from 'zod'

export namespace Zpn {
    /**
     * This field is used to represent a boolean that could be a checkbox in frontend with no specified value
     * That is: the value is 'on' or not present at all (default behavior of checkboxes)
     */
    export const checkboxOrBoolean = ({ message }: { label: string, message?: string }) => z.union([
        z.boolean(), // mosltly for the backend
        zfd.repeatable(z.literal('on', {
            errorMap: message ? () => ({ message }) : undefined,
        }).or(z.literal(FIELD_IS_PRESENT_VALUE)).array()) // mostly for the frontend (forms)
    ]).transform(value => {
        if (typeof value === 'boolean') return value
        if (value.includes('on')) return true
        return false
    })

    /**
     * This field is used to represent a list of enums that could be checkboxes in frontend with values as the enum values
     * In the array it is also allowd to have the value FIELD_IS_PRESENT_VALUE
     * so that the server can detect that the field is present
     * @returns
     */
    export const enumListCheckboxFriendly = <T extends EnumLike>({ enum: enumValues }: {
        label: string,
        enum: T
    }) => z.union([
            z.nativeEnum(enumValues).array(), // mosltly for the backend
            zfd.repeatable( // mostly for the frontend (forms)
                (z.nativeEnum(enumValues).or(z.literal(FIELD_IS_PRESENT_VALUE))).array(),
            )
        ]).transform(values => {
            const filtered: T[keyof T][] = []
            for (const value of values) {
                if (value === FIELD_IS_PRESENT_VALUE) continue
                filtered.push(value)
            }
            return filtered
        })

    /**
     * This field is used to represent a list of numbers that could be checkboxes in frontend with values as the numbers
     * In the array it is also allowd to have the value FIELD_IS_PRESENT_VALUE
     * so that the server can detect that the field is present
     */
    export const numberListCheckboxFriendly = ({ }: { label: string }) => z.union([
        z.number().array(), // mosltly for the backend
        zfd.repeatable(z.coerce.number().or(z.literal(FIELD_IS_PRESENT_VALUE)).array()) // mostly for the frontend (forms)
    ]).transform(values => {
        const filtered: number[] = []
        for (const value of values) {
            if (value === FIELD_IS_PRESENT_VALUE) continue
            filtered.push(value)
        }
        return filtered
    })

    /**
     * A field whose value is too nested for FormData to carry field by field - a form submits it as
     * JSON in a single hidden input, while the backend passes the value itself.
     */
    export const json = <Schema extends z.ZodTypeAny>({ label, schema }: {
        label: string,
        schema: Schema,
    }) => z.union([
            schema, // mostly for the backend
            z.string().transform((value, ctx) => { // mostly for the frontend (forms)
                try {
                    return JSON.parse(value) as unknown
                } catch {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${label} er ikke gyldig JSON`,
                    })
                    return z.NEVER
                }
            }).pipe(schema),
        ])

    export const date = ({ label }: { label: string }) =>
        z.union([
            z.string()
                .transform((val) => new Date(val))
                .refine((datetime) => !isNaN(datetime.getTime()), {
                    message: `${label} er ugyldig`,
                }),
            z.date()
        ])

    export const simpleCronExpression = () => z.string().superRefine((inp, ctx) => {
        try {
            dateMatchCron(new Date(), inp)
        } catch (e) {
            if (e instanceof Error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: e.message,
                })
            } else {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'En uventet feil oppsto under tolking av cron-uttrykket.',
                })
            }
        }
    })

    export const colorInput = () => z.string().regex(
        /^#[0-9A-Fa-f]{6}$/, 'Farge må være en gyldig hex-farge'
    ).transform(
        value => value.toUpperCase()
    ).transform(
        value => ({
            red: parseInt(value.slice(1, 3), 16),
            green: parseInt(value.slice(3, 5), 16),
            blue: parseInt(value.slice(5, 7), 16),
        })
    )
}
