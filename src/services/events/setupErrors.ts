import type { ErrorMessage } from '@/services/error'

type PostedVariant = { name?: unknown, quotas?: { name?: unknown }[] }

/**
 * Says which variant, and which quota of it, an error about the posted variants is about. An
 * error from the schema of the save names the variant by its place in the list alone, which the
 * one saving never sees. A variant or quota that is the only one goes unnamed, as in the setup checks.
 */
export function nameVariantInErrors(errors: ErrorMessage[], variants: PostedVariant[]): ErrorMessage[] {
    return errors.map(error => {
        const [field, variantIndex, part, quotaIndex] = error.path ?? []
        if (field !== 'variants' || typeof variantIndex !== 'number') return error
        const variant = variants.at(variantIndex)
        const quota = part === 'quotas' && typeof quotaIndex === 'number' ? variant?.quotas?.at(quotaIndex) : undefined

        const names = [
            ...(variants.length > 1 && typeof variant?.name === 'string' ? [variant.name] : []),
            ...((variant?.quotas?.length ?? 0) > 1 && typeof quota?.name === 'string' ? [`kvoten ${quota.name}`] : []),
        ]
        return names.length > 0 ? { ...error, message: `${names.join(', ')}: ${error.message}` } : error
    })
}
