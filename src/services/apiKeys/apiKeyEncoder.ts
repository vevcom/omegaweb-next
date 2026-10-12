import { ServiceError } from '@/services/error'

/**
 * This function encodes the key and id into a single string
 * This is the string that is used by clients to authenticate
 * @param key - The key to encode
 * @param id - The id to encode
 * @returns - The encoded key
 */
export function encodeApiKey({
    key, id
}: { key: string, id: number }) {
    return `id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`
}

/**
 * Takes a key and id encoded in `id=123&key=abc` format and decodes it
 * @param key - The key to decode
 * @returns - The decoded key and id
 */
export function decodeApiKey(key: string) {
    const params = new URLSearchParams(key)
    const id = params.get('id')
    const keyStr = params.get('key')
    if (!id || !keyStr || isNaN(parseInt(id, 10))) {
        throw new ServiceError('BAD PARAMETERS', 'Invalid key')
    }
    return {
        id: parseInt(id, 10),
        key: keyStr
    }
}
