import '@pn-server-only'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * The S3 bucket of the store. Without one every file is on the volume, the `store` directory on
 * disk, which is what development and the tests run on.
 */
export const storeS3Config = process.env.STORE_S3_BUCKET ? {
    bucket: process.env.STORE_S3_BUCKET,
    endpoint: process.env.STORE_S3_ENDPOINT,
    region: process.env.STORE_S3_REGION || 'us-east-1',
    accessKeyId: process.env.STORE_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORE_S3_SECRET_ACCESS_KEY ?? '',
} : null

export type StoreS3Config = NonNullable<typeof storeS3Config>

/** A relation through which a row refers to a store file. */
export type StoreFileOwner = keyof Prisma.StoreFileInclude

/**
 * Every relation through which a row may refer to a store file. A relation added to the StoreFile
 * model is a type error here until it is listed.
 */
export const storeFileOwners = Object.keys({
    ombul: true,
    originalOfImage: true,
    microSizeOf: true,
    tinySizeOf: true,
    smallSizeOf: true,
    mediumSizeOf: true,
    largeSizeOf: true,
    hugeSizeOf: true,
} satisfies Record<StoreFileOwner, true>) as StoreFileOwner[]

export const storeUpkeep = {
    /** How often the worker of a purpose looks for orphans and for files to move. */
    intervalMs: 5 * 60 * 1000,
    /**
     * How old a file is before it can be an orphan. A file is stored before the row that owns it is
     * committed, so a new file with no owner may only be waiting for one.
     */
    orphanGraceMs: 60 * 60 * 1000,
    /** How many files are read from the database at a time. */
    batchSize: 200,
} as const

export const untrackedFiles = {
    /** How often the store is listed for files no StoreFile row names. */
    intervalMs: 60 * 60 * 1000,
    /** How many file names are listed and looked up in the database at a time. */
    batchSize: 500,
    /**
     * How long a file must have gone without a row on every run before it is destroyed. A day
     * outlasts any reset, restore or seeding of the database, during which every file looks untracked.
     */
    confirmAfterMs: 24 * 60 * 60 * 1000,
} as const
