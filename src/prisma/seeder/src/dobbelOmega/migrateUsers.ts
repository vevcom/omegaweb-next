import { type IdMapper, owIdToPnId } from './IdMapper'
import { migratedOrder } from './migratedOrder'
import { inferClassLadder } from './classLadder'
import { createProgressBar } from './progressBar'
import { createCmsParagraph } from './createCmsParagraph'
import manifest from '@/prisma/seeder/src/dobbelOmega/manifest'
import { Prisma, type PrismaClient as PrismaClientPn, type SEX } from '@/prisma-generated-pn-client'
import logger from '@/lib/logger'
import { CLASS_LEVEL_ORDERING } from '@/services/groups/constants'
import { allAdmissions } from '@/services/admission/constants'
import { v4 as uuid } from 'uuid'
import type { User } from '@/prisma-generated-pn-client'
import type {
    Prisma as OwPrisma,
    PrismaClient as PrismaClientOw,
    enum_Users_sex as SEXOW,
} from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'
import type { Record } from '@prisma/client/runtime/client'

/**
 * TODO: Need migrate reservations (mail reservations) ?, and flairs
 * This function migrates users from Omegaweb-basic to PN. It only migrates to theUser model, not FeideAccounts
 * or Credentials. These should be linked when people log in for the first time.
 * If a user has the soelle field true on Omegaweb-basic it will get a relation to the soelle group
 * - else it is assumed to be a member and an inactive relation to the soelle group.
 * i.e. no users are assumed to be external. Every membership is of the order the user was taken up in.
 *
 * Omegaweb-basic had no notion of omega orders beyond the one a user was taken up in, so the orders
 * are never created here: they come from the seeder, and an order inferred past the current one is
 * reported and brought down to it (see `migratedOrder`).
 *
 * A migrated member is also given every admission trial. Being a sysken and having sat all of them
 * are the same statement in projectNext - the membership is read back from the trials when it has
 * to be worked out again - so a member without them would fall back to a soelle. Omegaweb-basic
 * does not record the trials themselves, so a migrated soelle is assumed to have sat none: it is
 * the only thing the data supports.
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param limits - Limits - used to limit the number of users to migrate
 */

// Placeholder emails must not be able to receive mail: the site itself hands out aliases on omega.ntnu.no.
const placeholderEmailDomain = 'dobbelomega.invalid'

const sexMap = {
    // eslint-disable-next-line id-length
    m: 'MALE',
    // eslint-disable-next-line id-length
    f: 'FEMALE',
    other: 'OTHER',
} as const satisfies Record<SEXOW, SEX>

type ExtendedMemberGroup = Prisma.OmegaMembershipGroupGetPayload<{
    include: {
        group: true,
    }
}>

const userIncluder = {
    StudyProgrammes: {
        select: {
            years: true,
        },
    },
    MoneySourceAccounts: {
        select: {
            NTNUCard: true,
        },
    },
} satisfies OwPrisma.UsersInclude

type userExtended = OwPrisma.UsersGetPayload<{
    include: typeof userIncluder
}>

// Map from flair-number in ow to the rank in pn
const flairMap: Record<number, number> = {
    1: 3, // Gull
    2: 4, // Sølv
    3: 5, // Bronse
    5: 2, // Diamant
    7: 1, // Påske kappe
}

export class UserMigrator {
    private userIdMap: Record<number, number> = {}
    private currentlyMigratingIds: Record<number, Promise<unknown>> = {}
    private progressBar?: ReturnType<typeof createProgressBar>

    private pnPrisma: PrismaClientPn
    private owPrisma: PrismaClientOw
    private imageIdMap: IdMapper


    private soelleGroup?: ExtendedMemberGroup
    private memberGroup?: ExtendedMemberGroup
    private classes: Prisma.ClassGetPayload<{
        include: {
            group: true
        }
    }>[] = []

    constructor(
        pnPrisma: PrismaClientPn,
        owPrisma: PrismaClientOw,
        imageIdMap: IdMapper,
    ) {
        this.pnPrisma = pnPrisma
        this.owPrisma = owPrisma
        this.imageIdMap = imageIdMap
    }

    async initSpecialGroups() {
        this.soelleGroup = await this.pnPrisma.omegaMembershipGroup.findUniqueOrThrow({
            where: {
                omegaMembershipLevel: 'SOELLE' //Avsky!
            },
            include: {
                group: true
            }
        })
        this.memberGroup = await this.pnPrisma.omegaMembershipGroup.findUniqueOrThrow({
            where: {
                omegaMembershipLevel: 'SYSKEN'
            },
            include: {
                group: true
            }
        })

        this.classes = await this.pnPrisma.class.findMany({
            include: {
                group: true
            }
        })
    }

    /**
     * The group every active member of Omega belongs to. Used by migrations that have to
     * restrict something to members - visibility on members-only news, for instance.
     */
    getMemberGroupId() {
        if (!this.memberGroup) {
            throw new Error('Cannot use the UserMigrator, before it is initialized.')
        }
        return this.memberGroup.groupId
    }

    yearIdMap(x: number) {
        const level = CLASS_LEVEL_ORDERING[x - 1]
        const classGroup = level ? this.classes.find(cls => cls.level === level) : undefined
        if (!classGroup) {
            manifest.error(`Year ${x} not found - dobbelOmega failed :(`)
            throw new Error(`Year ${x} not found`)
        }
        return classGroup.group.id
    }

    async migrateUsers(limits: Limits) {
        const users = await this.owPrisma.users.findMany({
            take: limits.users ? limits.users : undefined,
            select: {
                id: true,
            },
        })

        if (limits.users) {
            const extraUsers = await Promise.all([
                'theodokl104',
                'martiarm104',
                'johanhst103',
                'pauliusj103'
            ].map(async uname =>
                await this.owPrisma.users.findUnique({
                    where: {
                        username_order: {
                            username: uname.slice(0, -3),
                            order: Number(uname.slice(-3))
                        }
                    },
                    select: {
                        id: true,
                    }
                })
            ))

            extraUsers.forEach(user => {
                if (user) users.push(user)
            })
        }

        const userIds = users.map(user => user.id)

        this.progressBar = createProgressBar('Migrating users', userIds.length)
        try {
            return await this.migrateBulk(userIds)
        } finally {
            this.progressBar.stop()
            this.progressBar = undefined
        }
    }

    async getPnUserId(owId: number) {
        if (!this.userIdMap[owId]) {
            await this.migrateUser(owId)
        }
        return this.userIdMap[owId]
    }

    async migrateUser(owId: number) {
        return await this.migrateBulk([owId])
    }

    private async createUser(user: userExtended) {
        function collosionError(err: unknown) {
            if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
                throw err
            }

            if (err.code !== 'P2002' || !err.meta) {
                throw err
            }

            const meta = err.meta as {
                driverAdapterError?: {
                    table?: string
                    cause?: {
                        constraint?: { fields?: string[] } | { index?: string }
                    }
                }
            }

            const constraint = meta.driverAdapterError?.cause?.constraint
            if (!constraint) {
                throw err
            }

            // Postgres names the constraint it violated, and the adapter passes that name on as
            // `index` - the field list only comes through when the error carried no name. The
            // columns sit between the table prefix and the `_key` suffix: `User_email_key`.
            const table = meta.driverAdapterError?.table
            const indexName = 'index' in constraint ? constraint.index : undefined
            const target = 'fields' in constraint ? constraint.fields : indexName
                ?.replace(table ? `${table}_` : '', '')
                .replace(/_key$/, '')
                .split('_')

            if (!target) {
                throw err
            }

            const usernameCollision = target.includes('username')
            const emailCollision = target.includes('email')

            if (!usernameCollision && !emailCollision) {
                throw err
            }

            return [usernameCollision, emailCollision]
        }

        // A user who never wrote a bio still gets the paragraph, ready to be written in.
        const bioParagraph = user.bio
            ? await createCmsParagraph(this.pnPrisma, user.bio)
            : await this.pnPrisma.cmsParagraph.create({ data: {} })

        const ledgerAccount = await this.pnPrisma.ledgerAccount.create({
            data: { type: 'USER' },
        })

        const userData = {
            username: user.username.toLowerCase(),
            email: user.email ? user.email.toLowerCase() : `dobbel-${user.id}@${placeholderEmailDomain}`,
            firstname: user.firstname,
            lastname: user.lastname,
            bioParagraphId: bioParagraph.id,
            acceptedTerms: undefined,
            sex: sexMap[user.sex],
            allergies: undefined,
            mobile: undefined,
            emailVerified: undefined,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            imageId: owIdToPnId(this.imageIdMap, user.ImageId, 'images'),
            archived: user.archived,
            ledgerAccountId: ledgerAccount.id,
        } satisfies Prisma.UserUncheckedCreateInput

        let pnUser: User | undefined

        const createUserRetryOnFail = async (retries: number) => {
            try {
                pnUser = await this.pnPrisma.user.create({
                    data: userData
                })
            } catch (e) {
                const [usernameCollision, emailCollision] = collosionError(e)

                if (usernameCollision) {
                    manifest.error(`User ${user.id} has a colliding username: ${user.username}. Generating new username.`)
                    userData.username = `${user.username}-${user.id}-${uuid()}`
                }

                if (emailCollision) {
                    manifest.error(`User ${user.id} has a colliding email: ${user.email}. Generating new email.`)
                    userData.email = `dobbelomega-${user.id}-${uuid()}@${placeholderEmailDomain}`
                }

                if (retries > 0) {
                    await createUserRetryOnFail(retries - 1)
                }
            }
        }

        await createUserRetryOnFail(2)

        if (!pnUser) {
            throw new Error('Failed to migrate user to projectNext due to unique constraint violation in username or email.')
        }


        this.userIdMap[user.id] = pnUser.id

        // Try to add the studentCard, this can throw an unique contraint exception
        if (user.MoneySourceAccounts?.NTNUCard) {
            try {
                await this.pnPrisma.user.update({
                    where: {
                        id: pnUser.id
                    },
                    data: {
                        studentCard: user.MoneySourceAccounts?.NTNUCard
                    }
                })
            } catch (e) {
                logger.error(
                    `Failed to conenct StudentCard to user. StudentCard: ${user.MoneySourceAccounts?.NTNUCard} `,
                    { user: pnUser, error: e }
                )
            }
        }

        // Add a flair
        if (user.flair > 0 && user.flair !== 6) {
            // I'm sorry wilhelwi100 and magnmaeh100 your Piinligheed Cringemeisteren dies in this migration
            // Noooo!!! :(((
            const flairRank = flairMap[user.flair]
            if (!flairRank) {
                logger.error(`Unknown flair found: ${user.flair}.`)
            } else {
                await this.pnPrisma.flair.update({
                    where: {
                        rank: flairRank
                    },
                    data: {
                        user: {
                            connect: {
                                id: pnUser.id
                            }
                        }
                    }
                })
            }
        }

        return pnUser
    }

    async migrateBulk(owIds: number[]) {
        const owIdsToMigrate = owIds.filter(id => !this.userIdMap[id])
        const waitForParalell: Promise<unknown>[] = []
        const resolveWhenFinished: ((value: unknown) => void)[] = []
        for (let i = owIdsToMigrate.length - 1; i >= 0; i--) {
            const id = owIdsToMigrate[i]
            if (this.currentlyMigratingIds.hasOwnProperty(id)) {
                waitForParalell.push(this.currentlyMigratingIds[id])
                owIdsToMigrate.splice(i, 1)
            } else {
                this.currentlyMigratingIds[id] = new Promise((resolve) => {
                    resolveWhenFinished.push(resolve)
                })
            }
        }

        if (owIdsToMigrate.length === 0 && resolveWhenFinished.length === 0) {
            await Promise.all(waitForParalell)
            return
        }

        const users = await this.owPrisma.users.findMany({
            where: {
                id: {
                    in: owIdsToMigrate,
                }
            },
            include: userIncluder,
        })
        // manifest.info(`Migrating ${users.length} users`)

        await Promise.all(users.map(async user => {
            const pnUser = await this.createUser(user)

            if (!this.soelleGroup || !this.memberGroup) {
                throw new Error('Cannot use th UserMigrator, before it is initialized.')
            }

            // The omega memberships are of the order the user was taken up in, as in projectNext,
            // where the level is granted within an order and the membership records which. Every
            // member was a soelle first, so a sysken keeps that membership inactive - the state
            // `writeUserLevel` leaves a user promoted in the app in. Omegaweb-basic does not say
            // when the promotion happened, so it is taken to be within the order they came in.
            const order = migratedOrder(user.order, `User ${user.id}`)
            await this.pnPrisma.membership.create({
                data: {
                    groupId: this.soelleGroup.groupId,
                    userId: pnUser.id,
                    active: user.soelle,
                    admin: false,
                    order,
                }
            })

            if (!user.soelle) {
                await this.pnPrisma.membership.create({
                    data: {
                        groupId: this.memberGroup.groupId,
                        userId: pnUser.id,
                        active: true,
                        admin: false,
                        order,
                    }
                })

                // Dated to when the user was created rather than to now: the trials are inferred
                // from the membership rather than migrated, and a sysken from an old order having
                // sat their trials today would read as nonsense. Nobody registered them, which
                // `registeredById` being nullable already allows for.
                await this.pnPrisma.admissionTrial.createMany({
                    data: allAdmissions.map(admission => ({
                        userId: pnUser.id,
                        admission,
                        datetime: user.createdAt,
                    })),
                    skipDuplicates: true,
                })
            }

            // connect to correct class (year)
            const classLadder = inferClassLadder({
                id: user.id,
                order: user.order,
                yearOfStudy: user.yearOfStudy,
                yearsInProgramme: Math.min(user.StudyProgrammes?.years ?? 0, 5),
            })
            await Promise.all(classLadder.map(rung => this.pnPrisma.membership.create({
                data: {
                    groupId: this.yearIdMap(rung.year),
                    userId: pnUser.id,
                    active: rung.active,
                    admin: false,
                    order: rung.order,
                }
            })))

            this.progressBar?.increment()
        }))

        resolveWhenFinished.forEach(resolve => resolve(undefined))
        await Promise.all(waitForParalell)
    }
}
