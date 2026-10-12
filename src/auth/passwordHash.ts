import '@pn-server-only'
import { hashAndEncrypter } from '@/lib/crypto/hashAndEncrypter'

export const {
    hashAndEncrypt: hashAndEncryptPassword,
    decryptAndCompare: decryptAndComparePassword
} = hashAndEncrypter(process.env.PASSWORD_SALT_ROUNDS, process.env.PASSWORD_ENCRYPTION_KEY)
