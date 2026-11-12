import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { decryptAndComparePassword } from '@/auth/passwordHash'

/**
 * The company user an email and a password sign in as, null when they sign in as no one: no active
 * company user has the email, the company user has yet to choose a password, or the password is
 * wrong. The caller is told nothing of which, so the login cannot be used to learn who is registered.
 */
export async function companyUserIdOfCredentials(email: string, password: string): Promise<number | null> {
    const companyUser = await prisma.companyUser.findFirst({
        where: { email: email.trim().toLowerCase(), active: true },
        select: { id: true, credentials: { select: { passwordHash: true } } },
    })
    if (!companyUser?.credentials) return null

    const matches = await decryptAndComparePassword(password, companyUser.credentials.passwordHash)
    return matches ? companyUser.id : null
}
