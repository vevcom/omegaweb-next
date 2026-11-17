import '@ow-server-only'
import { hashAndEncrypter } from '@/lib/crypto/hashAndEncrypter'

export const {
    hashAndEncrypt: apiKeyHashAndEncrypt,
    decryptAndCompare: apiKeyDecryptAndCompare
} = hashAndEncrypter(process.env.API_KEY_SALT_ROUNDS, process.env.API_KEY_ENCRYPTION_KEY)
