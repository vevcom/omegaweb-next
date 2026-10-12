import { seedAdmin } from '@/prisma/seeder/src/standardContent/seedAdmin'
import { prisma } from '@/prisma-pn-client-instance'
import { decryptAndComparePassword } from '@/auth/passwordHash'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

const username = 'seed-admin-rotation'
const originalEnv = { ...process.env }

async function readAdmin() {
    return prisma.user.findUniqueOrThrow({
        where: { username },
        select: { sessionEpoch: true, credentials: { select: { passwordHash: true } } },
    })
}

beforeAll(() => {
    process.env.SEED_ADMIN_USERNAME = username
    process.env.SEED_ADMIN_EMAIL = `${username}@omega.ntnu.no`
    process.env.SEED_ADMIN_PASSWORD = 'first-password'
})

afterAll(() => {
    process.env = originalEnv
})

describe('seeding the admin user', () => {
    test('re-seeding keeps the sessions, rotating the password ends them', async () => {
        await seedAdmin()
        const seeded = await readAdmin()

        await seedAdmin()
        expect((await readAdmin()).sessionEpoch).toBe(seeded.sessionEpoch)

        process.env.SEED_ADMIN_PASSWORD = 'second-password'
        await seedAdmin()
        const rotated = await readAdmin()
        expect(rotated.sessionEpoch).toBe(seeded.sessionEpoch + 1)
        expect(await decryptAndComparePassword('second-password', rotated.credentials!.passwordHash)).toBe(true)
    })
})
