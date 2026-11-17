import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { decryptAndComparePassword, hashAndEncryptPassword } from '@/auth/passwordHash'
import { randomBytes } from 'node:crypto'

/**
 * The hash of a password nobody has, to compare against when there is no hash of the company
 * user's to compare against. Made once, the first time it is needed.
 */
let hashOfNoPassword: Promise<string> | undefined

/**
 * The company user an email and a password sign in as, null when they sign in as no one: no active
 * company user has the email, the company user has yet to choose a password, or the password is
 * wrong. The caller is told nothing of which, so the login cannot be used to learn who is registered.
 * A password is compared in every case, so neither can how long the answer takes.
 */
export async function companyUserIdOfCredentials(email: string, password: string): Promise<number | null> {
    const companyUser = await prisma.companyUser.findFirst({
        where: { email: email.trim().toLowerCase(), active: true },
        select: { id: true, credentials: { select: { passwordHash: true } } },
    })
    hashOfNoPassword ??= hashAndEncryptPassword(randomBytes(32).toString('base64'))
    const passwordHash = companyUser?.credentials?.passwordHash ?? await hashOfNoPassword

    const matches = await decryptAndComparePassword(password, passwordHash)
    return matches && companyUser?.credentials ? companyUser.id : null
}
