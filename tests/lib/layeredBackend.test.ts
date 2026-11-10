import { createLayeredBackend, moveBucketFilesToDisk } from '@/lib/store/backend'
import { describe, expect, test } from '@jest/globals'
import type { StoreBackend } from '@/lib/store/types'

function memoryBackend(files: Record<string, string> = {}): StoreBackend & { keys: () => string[] } {
    const stored = new Map<string, Buffer>(Object.entries(files).map(([key, content]) => [key, Buffer.from(content)]))
    return {
        keys: () => Array.from(stored.keys()).sort(),
        write: (key, content) => {
            stored.set(key, content)
            return Promise.resolve()
        },
        read: key => Promise.resolve(stored.get(key) ?? null),
        stream: () => Promise.resolve(null),
        exists: key => Promise.resolve(stored.has(key)),
        destroy: key => Promise.resolve(stored.delete(key)),
        // eslint-disable-next-line @typescript-eslint/require-await
        async *list(prefix) {
            const names = Array.from(stored.keys())
                .filter(key => key.startsWith(`${prefix}/`))
                .map(key => key.slice(prefix.length + 1))
            if (names.length > 0) yield names
        },
    }
}

describe('createLayeredBackend', () => {
    test('reads, lists and destroys on both, and writes to the bucket', async () => {
        const disk = memoryBackend({ 'images/variant.avif': 'variant' })
        const bucket = memoryBackend({ 'images/original.png': 'original' })
        const backend = createLayeredBackend(disk, bucket)

        expect((await backend.read('images/variant.avif'))?.toString()).toBe('variant')
        expect((await backend.read('images/original.png'))?.toString()).toBe('original')
        expect(await backend.read('images/missing.png')).toBeNull()
        expect(await backend.exists('images/original.png')).toBe(true)

        const listed: string[] = []
        for await (const batch of backend.list('images', 500)) listed.push(...batch)
        expect(listed.sort()).toEqual(['original.png', 'variant.avif'])

        await backend.write('images/new.png', Buffer.from('new'))
        expect(bucket.keys()).toContain('images/new.png')
        expect(disk.keys()).toEqual(['images/variant.avif'])

        expect(await backend.destroy('images/variant.avif')).toBe(true)
        expect(await backend.destroy('images/original.png')).toBe(true)
        expect(await backend.destroy('images/missing.png')).toBe(false)
        expect(disk.keys()).toEqual([])
        expect(bucket.keys()).toEqual(['images/new.png'])
    })
})

describe('moveBucketFilesToDisk', () => {
    test('moves only the selected files, with their content', async () => {
        const disk = memoryBackend()
        const bucket = memoryBackend({ 'images/variant.avif': 'variant', 'images/original.png': 'original' })

        const moved = await moveBucketFilesToDisk(
            'images',
            names => names.filter(name => name.endsWith('.avif')),
            undefined,
            disk,
            bucket,
        )

        expect(moved).toBe(1)
        expect(bucket.keys()).toEqual(['images/original.png'])
        expect((await disk.read('images/variant.avif'))?.toString()).toBe('variant')
    })
})
