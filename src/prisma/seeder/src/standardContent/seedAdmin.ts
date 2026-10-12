import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import logger from '@/lib/logger'
import { decryptAndComparePassword, hashAndEncryptPassword } from '@/auth/passwordHash'
import { Permission } from '@/prisma-generated-pn-types'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

// The password .env.default ships, plus the obvious neighbours. A production
// environment that inherited the example file unchanged is refused outright
// rather than handed a guessable superuser holding every permission.
const INSECURE_PASSWORDS = ['admin', 'password', 'passord', 'changeme', 'secret']

/**
 * Seeds a single admin user with every permission, in its own ManualGroup, so there is
 * always a way to log in and debug a fresh environment - migrated/production users have
 * no password credentials (only Feide), which isn't reachable from every deployment.
 * Skipped unless SEED_ADMIN_USERNAME/EMAIL/PASSWORD are all set, so it stays opt-in per
 * environment rather than creating a guessable account on every deployment.
 */
export const seedAdmin = defineSeedOperation(async (prisma: PrismaClient) => {
    // Lowercased to match the credentials provider, which looks the row up by
    // `credentials.username.toLowerCase()` - a username seeded with any uppercase in
    // it would otherwise never match the row it just wrote, and the account could not
    // be logged in to at all.
    const username = process.env.SEED_ADMIN_USERNAME?.toLowerCase()
    const email = process.env.SEED_ADMIN_EMAIL
    const password = process.env.SEED_ADMIN_PASSWORD

    if (!username || !email || !password) {
        logger.info('SEED_ADMIN_USERNAME/EMAIL/PASSWORD not set, skipping admin seed')
        return
    }

    if (process.env.NODE_ENV === 'production' && INSECURE_PASSWORDS.includes(password.toLowerCase())) {
        throw new Error(
            'SEED_ADMIN_PASSWORD is one of the known example values, which would create a '
            + 'guessable account holding every permission. Set a real password, or unset '
            + 'SEED_ADMIN_USERNAME/EMAIL/PASSWORD to skip the admin seed entirely.'
        )
    }

    const latestOrder = await prisma.omegaOrder.findFirstOrThrow({
        orderBy: { order: 'desc' },
    })

    const existingGroup = await prisma.manualGroup.findUnique({
        where: { shortName: 'admin' },
    })

    // Reusing a group that DobbelOmega (or an earlier seed) already created keeps
    // whatever permissions it came with, which is not necessarily all of them.
    // readPermissionsOfUser resolves permissions through the membership's groups, so a
    // reused group missing e.g. EVENT_ADMIN - not a default permission - produces an
    // "admin" that half the site still refuses. Fill in the gaps.
    if (existingGroup) {
        await prisma.groupPermission.createMany({
            data: Object.values(Permission).map(permission => ({
                groupId: existingGroup.groupId,
                permission,
            })),
            skipDuplicates: true,
        })
    }

    const adminGroup = existingGroup ?? await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: latestOrder.order,
            manualGroup: {
                create: {
                    name: 'Admin',
                    shortName: 'admin',
                },
            },
            permissions: {
                create: Object.values(Permission).map(permission => ({ permission })),
            },
        },
        include: {
            manualGroup: true,
        },
    }).then(group => group.manualGroup)

    if (!adminGroup) {
        throw new Error('Failed to seed admin group')
    }

    const existingUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
    })

    const user = existingUser ?? await prisma.user.create({
        data: {
            username,
            email,
            firstname: 'Admin',
            lastname: 'Admin',
            emailVerified: new Date(),
            acceptedTerms: new Date(),
            bioParagraph: { create: {} },
            ledgerAccount: {
                create: { type: 'USER' },
            },
        },
    })

    // Every user holds exactly one omega membership, and the admin is created here with raw
    // prisma rather than through userOperations.create, which is what normally places one. A
    // user holding none is a state the system calls broken and rewrites at read time, so the
    // admin is placed the same way a new user is: at the level their study programmes imply,
    // and only ever upwards, so re-seeding cannot demote an account the admin name matched.
    const omegaMembershipLevel = await omegaMembershipGroupOperations.inferUserLevel({
        params: { userId: user.id },
        bypassAuth: true,
    })

    await omegaMembershipGroupOperations.updateUserLevel({
        params: { userId: user.id, omegaMembershipLevel, onlyUpgrade: true },
        bypassAuth: true,
    })

    // Upserted rather than nested in the create above, which only ever ran for a brand
    // new user. A migrated account matching SEED_ADMIN_USERNAME has no credentials at
    // all - DobbelOmega brings over Feide accounts only - so it would have been handed
    // an admin membership with no way to log in to it. Writing the hash on every run
    // also makes the env var the source of truth, so rotating SEED_ADMIN_PASSWORD
    // takes effect instead of silently keeping the old password.
    const passwordHash = await hashAndEncryptPassword(password)
    const existingCredentials = await prisma.credentials.findUnique({
        where: { userId: user.id },
        select: { passwordHash: true },
    })
    const passwordRotated = existingCredentials !== null
        && !await decryptAndComparePassword(password, existingCredentials.passwordHash)

    // Nested under the user: Credentials keys off (userId, username, email), and the nested write
    // fills all three. Like updatePassword, a rotated password ends the sessions started with the old
    // one in the same write - only on an actual change, since the hash is rewritten on every run.
    await prisma.user.update({
        where: { id: user.id },
        data: {
            credentials: { upsert: { create: { passwordHash }, update: { passwordHash } } },
            ...(passwordRotated ? { sessionEpoch: { increment: 1 } } : {}),
        },
    })

    await prisma.membership.upsert({
        where: {
            userId_groupId_order: {
                userId: user.id,
                groupId: adminGroup.groupId,
                order: latestOrder.order,
            },
        },
        update: {},
        create: {
            userId: user.id,
            groupId: adminGroup.groupId,
            admin: true,
            active: true,
            order: latestOrder.order,
        },
    })

    logger.info(`Seeded admin user "${username}"`)
})
