import { hashAndEncryptPassword } from '@/auth/passwordHash'
import { userOperations } from '@/services/users/operations'
import { standardStoreFiles } from '@/lib/standardStore/files'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { Admission, OmegaMembershipLevel, type Prisma } from '@/prisma-generated-pn-types'
import { v4 as uuid } from 'uuid'
import { randomInt } from 'crypto'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const allAdmissions = Object.values(Admission)

/**
 * Which omega membership a dev user is seeded into, and the admission trials that go with it.
 *
 * The two have to agree, since that is the invariant the rest of the system upholds: a sysken is
 * someone who has sat every trial, and anyone who has sat every trial is made a sysken. So only a
 * soelle is given part of the set - never all of it - and den gemene hob none at all, having never
 * been let in to start.
 *
 * It is derived from the user's position rather than drawn at random so that re-seeding puts every
 * user back exactly where they were.
 */
function omegaStandingOf(index: number): { level: OmegaMembershipLevel, trials: Admission[] } {
    switch (index % 3) {
        case 0:
            return { level: OmegaMembershipLevel.DEN_GEMENE_HOB, trials: [] }
        case 1:
            return {
                level: OmegaMembershipLevel.SOELLE,
                trials: allAdmissions.slice(0, index % allAdmissions.length),
            }
        default:
            return { level: OmegaMembershipLevel.SYSKEN, trials: allAdmissions }
    }
}

export const seedDevUsers = defineSeedOperation(async (prisma: PrismaClient) => {
    const firstNames = [
        'Anne', 'Johan', 'Pål', 'Lars', 'Lasse', 'Leo', 'Noa',
        'Trude', 'Andreas', 'Nora', 'Knut', 'Anne', 'Sara',
        'Frikk', 'Merete', 'Klara', 'Britt Helen', 'Fiola',
        'Mika', 'Helle', 'Jesper',
    ]
    const devProfileImages = Object.entries(standardStoreFiles.devProfileImage)

    const passwordHash = await hashAndEncryptPassword('password')

    const latestOrder = await prisma.omegaOrder.findFirstOrThrow({
        orderBy: {
            order: 'desc',
        },
    })

    const omegaMembershipGroups = await prisma.omegaMembershipGroup.findMany({
        select: { groupId: true, omegaMembershipLevel: true },
    })
    const omegaGroupIdOf = (level: OmegaMembershipLevel) => omegaMembershipGroups
        .find(group => group.omegaMembershipLevel === level)!.groupId
    const syskenGroupId = omegaGroupIdOf(OmegaMembershipLevel.SYSKEN)

    const allStudyProgrammes = await prisma.studyProgramme.findMany()
    const allCommittees = await prisma.committee.findMany()
    const allClasses = await prisma.class.findMany()
    const allFlairs = await prisma.flair.findMany()

    const devUserSpecs = firstNames.flatMap((firstName, i) => devProfileImages.map(([lastName, devProfileImage], j) => ({
        firstName,
        lastName,
        devProfileImage,
        email: uuid(),
        username: `${firstName}${lastName}${i + 1}${j}`
            .toLowerCase()
            .replace(/å/g, 'aa') // special cases for norwegian letters
            .replace(/æ/g, 'ae')
            .replace(/ø/g, 'oe')
            .normalize('NFD') // decompose into letter + diacritics, i.e. 'é' -> 'e´'
            .replace(/[^a-zA-Z0-9]/g, ''), // only keep ASCII alphanumeric characters
    })))

    const existingUsers = await prisma.user.findMany({
        where: { username: { in: devUserSpecs.map(spec => spec.username) } },
        select: { id: true, username: true },
    })
    const existingUsernames = new Set(existingUsers.map(user => user.username))
    const newDevUserSpecs = devUserSpecs.filter(spec => !existingUsernames.has(spec.username))

    // createMany can't create relations, so the bio paragraphs are made up front - named after the user
    // they are for, since the order createManyAndReturn returns rows in is not guaranteed.
    const bioParagraphs = await prisma.cmsParagraph.createManyAndReturn({
        data: newDevUserSpecs.map(spec => ({ name: `userBio-${spec.username}` })),
        select: { id: true, name: true },
    })
    const bioParagraphIdByName = new Map(bioParagraphs.map(paragraph => [paragraph.name, paragraph.id]))

    const newLedgerAccounts = await prisma.ledgerAccount.createManyAndReturn({
        data: newDevUserSpecs.map(() => ({ type: 'USER' as const })),
        select: { id: true },
    })

    const createdUsers = await prisma.user.createManyAndReturn({
        data: newDevUserSpecs.map((spec, index) => ({
            firstname: spec.firstName,
            lastname: spec.lastName,
            email: spec.email,
            username: spec.username,
            studentCard: `${spec.username}s studentkort`,
            acceptedTerms: new Date(),
            bioParagraphId: bioParagraphIdByName.get(`userBio-${spec.username}`)!,
            ledgerAccountId: newLedgerAccounts[index].id,
        })),
        select: { id: true, username: true },
    })

    const userIdByUsername = new Map([
        ...existingUsers.map(user => [user.username, user.id] as const),
        ...createdUsers.map(user => [user.username, user.id] as const),
    ])

    await prisma.credentials.createMany({
        data: newDevUserSpecs.map(spec => ({
            userId: userIdByUsername.get(spec.username)!,
            username: spec.username,
            email: spec.email,
            passwordHash,
        })),
    })

    // Profile images can't be batched with createMany - each upload resizes to several
    // sizes, converts to avif and writes files to the store before any db write happens,
    // so this stays the slow part. Batched (rather than one big Promise.all) so the cpu
    // and db connection pool aren't overloaded from too many uploads running at once.
    // Only uploaded the first time this dev user is created - re-seeding must not upload
    // (and immediately destroy) a fresh profile image on every run.
    const profileImageJobs = newDevUserSpecs
        .filter(() => Math.random() < 0.10)
        .map(spec => async () => userOperations.updateProfileImage({
            params: { username: spec.username },
            data: await spec.devProfileImage.imageUploadData({
                name: spec.lastName,
                alt: `Bilde av ${spec.lastName}`,
            }),
        }))

    const imageUploadBatchSize = 8
    for (let i = 0; i < profileImageJobs.length; i += imageUploadBatchSize) {
        await Promise.all(profileImageJobs.slice(i, i + imageUploadBatchSize).map(job => job()))
    }

    // Only the omega membership follows from the user's place in the list - the rest are random, so
    // they are handed out once, when the user is created. Re-rolling them on every seed would give
    // the existing dev users a new study programme, class and committee on each dev restart.
    const memberships: Prisma.MembershipCreateManyInput[] = devUserSpecs.flatMap((spec, index) => {
        const userId = userIdByUsername.get(spec.username)!

        const omegaMembership: Prisma.MembershipCreateManyInput = {
            groupId: omegaGroupIdOf(omegaStandingOf(index).level),
            userId,
            admin: false,
            active: true,
            order: latestOrder.order
        }

        if (existingUsernames.has(spec.username)) return [omegaMembership]

        const specMemberships: Prisma.MembershipCreateManyInput[] = [
            omegaMembership,
            {
                groupId: allStudyProgrammes[randomInt(allStudyProgrammes.length)].groupId,
                userId,
                admin: false,
                active: true,
                order: latestOrder.order
            },
            {
                groupId: allClasses[randomInt(allClasses.length)].groupId,
                userId,
                admin: false,
                active: true,
                order: latestOrder.order,
            },
        ]

        if (Math.random() > 0.8) {
            specMemberships.push({
                groupId: allCommittees[randomInt(allCommittees.length)].groupId,
                userId,
                admin: false,
                active: true,
                order: latestOrder.order
            })
        }

        return specMemberships
    })

    // A user seeded before may sit at a different level this time round, and `skipDuplicates` would
    // leave them holding both memberships - and whichever trials went with the old one. Clearing the
    // pair out first is what keeps a re-seed from inventing a state the system says cannot exist.
    const devUserIds = devUserSpecs.map(spec => userIdByUsername.get(spec.username)!)

    await prisma.membership.deleteMany({
        where: {
            userId: { in: devUserIds },
            group: { groupType: 'OMEGA_MEMBERSHIP_GROUP' },
        },
    })
    await prisma.admissionTrial.deleteMany({
        where: { userId: { in: devUserIds } },
    })

    await prisma.membership.createMany({
        data: memberships,
        skipDuplicates: true,
    })

    await prisma.admissionTrial.createMany({
        data: devUserSpecs.flatMap((spec, index) => omegaStandingOf(index).trials.map(admission => ({
            userId: userIdByUsername.get(spec.username)!,
            admission,
        }))),
        skipDuplicates: true,
    })

    // Flairs are random too, so only new users get one - see the memberships above.
    await Promise.all(newDevUserSpecs
        .filter(() => Math.random() < 0.05)
        .map(spec => prisma.flair.update({
            where: {
                id: allFlairs[randomInt(allFlairs.length)].id,
            },
            data: {
                user: {
                    connect: {
                        id: userIdByUsername.get(spec.username)!
                    }
                }
            }
        })))

    const existingHarambe = await prisma.user.findUnique({
        where: { email: 'harambe@harambesen.io' },
        select: { id: true },
    })

    const harambe = existingHarambe ?? await prisma.user.create({
        data: {
            firstname: 'Harambe',
            lastname: 'Harambesen',
            email: 'harambe@harambesen.io',
            mobile: '12345678',
            username: 'harambe',
            bioParagraph: {
                create: {
                    contentMd: 'Harambe did nothing wrong',
                    contentHtml: '<p>Harambe did nothing wrong</p>',
                },
            },
            studentCard: 'harambeCard',
            credentials: {
                create: {
                    passwordHash,
                },
            },
            ledgerAccount: {
                create: {
                    type: 'USER',
                },
            },
            emailVerified: new Date(),
            acceptedTerms: new Date(),
        },
    })

    if (!existingHarambe) {
        await userOperations.updateProfileImage({
            params: { username: 'harambe' },
            data: await standardStoreFiles.harambe.imageUploadData({ name: 'Harambe', alt: 'Bilde av Harambe' }),
        })
    }

    const studyProgrammeMTTK = await prisma.studyProgramme.findUniqueOrThrow({
        where: {
            code: 'MTTK',
        },
    })

    const harambecom = await prisma.committee.findUniqueOrThrow({
        where: {
            shortName: 'harcom'
        }
    })

    const existingVever = await prisma.user.findUnique({
        where: { email: 'vever@vevcom.com' },
        select: { id: true },
    })

    const vever = existingVever ?? await prisma.user.create({
        data: {
            firstname: 'Vever',
            lastname: 'Vevsen',
            email: 'vever@vevcom.com',
            mobile: '98765432',
            username: 'vever',
            bioParagraph: { create: {} },
            studentCard: 'vever',
            credentials: {
                create: {
                    passwordHash,
                },
            },
            ledgerAccount: {
                create: {
                    type: 'USER',
                },
            },
            emailVerified: new Date(),
            acceptedTerms: new Date(),
        },
    })

    // Either of them may sit at another level by now, and `skipDuplicates` would leave that
    // membership standing beside the sysken one they are given here.
    await prisma.membership.deleteMany({
        where: {
            userId: { in: [harambe.id, vever.id] },
            group: { groupType: 'OMEGA_MEMBERSHIP_GROUP' },
        },
    })

    await prisma.membership.createMany({
        data: [
            {
                groupId: syskenGroupId,
                userId: harambe.id,
                admin: false,
                active: true,
                order: latestOrder.order
            },
            {
                groupId: studyProgrammeMTTK.groupId,
                userId: harambe.id,
                admin: false,
                active: true,
                order: latestOrder.order
            },
            {
                groupId: harambecom.groupId,
                userId: harambe.id,
                admin: false,
                active: true,
                order: latestOrder.order
            },
            {
                groupId: syskenGroupId,
                userId: vever.id,
                admin: false,
                active: true,
                order: latestOrder.order
            },
            {
                groupId: studyProgrammeMTTK.groupId,
                userId: vever.id,
                admin: false,
                active: true,
                order: latestOrder.order
            },
        ],
        skipDuplicates: true,
    })

    // Both are seeded as syskens, so both have to have sat every trial.
    await prisma.admissionTrial.createMany({
        data: [harambe.id, vever.id].flatMap(userId => allAdmissions.map(admission => ({
            userId,
            admission,
        }))),
        skipDuplicates: true,
    })
})
