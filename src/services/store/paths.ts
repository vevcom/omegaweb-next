import type { StoreFilePurpose } from '@/prisma-generated-pn-types'

/**
 * The directory of each purpose, in the store and in the url of its files. The two image purposes
 * share one, since an image's files were all kept there before they had purposes.
 */
export const storeDirectories = {
    OMBUL: 'ombul',
    ORIGINAL_IMAGE: 'images',
    CACHE_IMAGE: 'images',
} as const satisfies Record<StoreFilePurpose, string>

/** The path a store file is served at, from the name its owning row keeps. */
export function storeFilePath(purpose: StoreFilePurpose, name: string): string {
    return `/store/${storeDirectories[purpose]}/${name}`
}
