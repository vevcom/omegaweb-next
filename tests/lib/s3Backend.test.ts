import { createS3Backend } from '@/lib/store/s3Backend'
import { HeadBucketCommand, NoSuchKey, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { afterEach, describe, expect, jest, test } from '@jest/globals'

const backend = createS3Backend({
    bucket: 'test-bucket',
    endpoint: 'http://127.0.0.1:1',
    region: 'us-east-1',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
})

function storeAnswers(error: Error) {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(error as never)
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe('s3Backend', () => {
    test('a missing file is null', async () => {
        storeAnswers(new NoSuchKey({ message: 'No such key', $metadata: { httpStatusCode: 404 } }))

        await expect(backend.read('images/missing.avif')).resolves.toBeNull()
        await expect(backend.stream('images/missing.avif')).resolves.toBeNull()
    })

    test('a missing bucket is an error, not a missing file', async () => {
        const noSuchBucket = new S3ServiceException({
            name: 'NoSuchBucket',
            $fault: 'client',
            $metadata: { httpStatusCode: 404 },
        })
        storeAnswers(noSuchBucket)

        await expect(backend.read('images/file.avif')).rejects.toBe(noSuchBucket)
        await expect(backend.stream('images/file.avif')).rejects.toBe(noSuchBucket)
        await expect(backend.destroy('images/file.avif')).rejects.toBe(noSuchBucket)
    })

    test('destroying a missing file in a bucket that exists reports it as missing', async () => {
        const notFound = new S3ServiceException({
            name: 'NotFound',
            $fault: 'client',
            $metadata: { httpStatusCode: 404 },
        })
        jest.spyOn(S3Client.prototype, 'send').mockImplementation(((command: unknown) => (
            command instanceof HeadBucketCommand ? Promise.resolve({}) : Promise.reject(notFound)
        )) as never)

        await expect(backend.destroy('images/missing.avif')).resolves.toBe(false)
    })
})
