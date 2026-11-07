import '@pn-server-only'

/**
 * The S3 bucket the store keeps its files in. Without a bucket the store uses the `store` directory
 * on disk, which is what development and the tests run on.
 */
export const storeS3Config = process.env.STORE_S3_BUCKET ? {
    bucket: process.env.STORE_S3_BUCKET,
    endpoint: process.env.STORE_S3_ENDPOINT,
    region: process.env.STORE_S3_REGION || 'us-east-1',
    accessKeyId: process.env.STORE_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORE_S3_SECRET_ACCESS_KEY ?? '',
} : null

export type StoreS3Config = NonNullable<typeof storeS3Config>
