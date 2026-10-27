/**
 * Where the store keeps its files. A key is a path under the store, such as `images/<uuid>.avif`,
 * and is the same on disk and in S3, so files can be copied from one to the other as they are.
 */
export type StoreBackend = {
    write(key: string, content: Buffer): Promise<void>
    /** null when there is no such file. */
    read(key: string): Promise<Buffer | null>
    /** null when there is no such file. */
    stream(key: string): Promise<ReadableStream | null>
    exists(key: string): Promise<boolean>
    /** false when there was no such file. */
    destroy(key: string): Promise<boolean>
    /** The names of the files directly under the prefix, a batch at a time. */
    list(prefix: string, batchSize: number): AsyncGenerator<string[]>
}
