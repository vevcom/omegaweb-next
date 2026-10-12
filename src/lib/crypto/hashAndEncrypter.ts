import { hasher } from './hasher'
import { encrypter } from './encrypter'
import { ServiceError } from '@/services/error'
import type { EncrypterConfig } from './encrypter'

/**
 * WARNING: If you pass a undefined salt or encryptionKey, the function will throw an error.
 * This is done so one can pass environment variables to the function and it will throw an error
 *
 * The hashAndEnctypter uses the hasher and encrypter to hash and encrypt data.
 * it generates two methods one for hashing then encrypting data. And one for comparing
 * this (hashed and encrypted) data with other data.
 * @param salt - The number of rounds to use in the hashing.
 * @param encryptionKey - The key to use for encryption.
 * @param encrypterConfig - The configuration for the encryption.
 * @returns
 */
export function hashAndEncrypter(
    salt: string | undefined,
    encryptionKey: string | undefined,
    encrypterConfig: EncrypterConfig | undefined = undefined
) {
    function getFunctions() {
        if (!salt || !Number(salt)) {
            throw new ServiceError('SERVER ERROR', 'Serveren manger config')
        }
        if (!encryptionKey) {
            throw new ServiceError('SERVER ERROR', 'Serveren manger config')
        }
        const { hash, compare } = hasher(Number(salt))
        const { encrypt, decrypt } = encrypter(encryptionKey, encrypterConfig)
        return { hash, compare, encrypt, decrypt }
    }
    return {
        hashAndEncrypt: async (data: string) => {
            const { hash, encrypt } = getFunctions()
            const hashed = await hash(data)
            return encrypt(hashed)
        },
        decryptAndCompare: async (data: string, encryptedData: string) => {
            const { compare, decrypt } = getFunctions()
            const decrypted = decrypt(encryptedData)
            return compare(data, decrypted)
        }
    }
}
