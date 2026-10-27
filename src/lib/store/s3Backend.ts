import '@pn-server-only'
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ServiceException,
} from '@aws-sdk/client-s3'
import type { StoreS3Config } from './constants'
import type { StoreBackend } from './types'

function isNotFound(error: unknown) {
    return error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404
}

/** The store as objects in an S3 bucket, such as NTNU's object storage. */
export function createS3Backend(config: StoreS3Config): StoreBackend {
    const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        // S3-compatible stores such as NTNU's take the bucket in the path, not as a subdomain.
        forcePathStyle: true,
        // Some S3-compatible stores reject the checksums newer SDKs add to every request by default.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    })
    const Bucket = config.bucket

    async function get(key: string) {
        try {
            return await client.send(new GetObjectCommand({ Bucket, Key: key }))
        } catch (error) {
            if (isNotFound(error)) return null
            throw error
        }
    }

    async function exists(key: string) {
        try {
            await client.send(new HeadObjectCommand({ Bucket, Key: key }))
            return true
        } catch (error) {
            if (isNotFound(error)) return false
            throw error
        }
    }

    return {
        async write(key, content) {
            await client.send(new PutObjectCommand({ Bucket, Key: key, Body: content }))
        },

        async read(key) {
            const object = await get(key)
            return object?.Body ? Buffer.from(await object.Body.transformToByteArray()) : null
        },

        async stream(key) {
            const object = await get(key)
            return object?.Body ? object.Body.transformToWebStream() : null
        },

        exists,

        // S3 reports success for deleting a missing key, and a versioned bucket would keep a
        // delete marker for it, so the key is checked first.
        async destroy(key) {
            if (!await exists(key)) return false
            await client.send(new DeleteObjectCommand({ Bucket, Key: key }))
            return true
        },

        async *list(prefix, batchSize) {
            let continuationToken: string | undefined
            do {
                const page = await client.send(new ListObjectsV2Command({
                    Bucket,
                    Prefix: `${prefix}/`,
                    Delimiter: '/',
                    MaxKeys: batchSize,
                    ContinuationToken: continuationToken,
                }))
                const names = (page.Contents ?? []).flatMap(object => (
                    object.Key ? [object.Key.slice(prefix.length + 1)] : []
                ))
                if (names.length > 0) yield names
                continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
            } while (continuationToken)
        },
    }
}
