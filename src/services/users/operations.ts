import '@pn-server-only'
import { userSchemas } from './schemas'
import { userAuth } from './auth'
import {
    defaultSearchResultLimit,
    maxNumberOfGroupsInFilter,
    standardMembershipSelection,
    userBasicSelection,
    userCardSelection,
    userPartitions,
    userPrivateSelection,
    userProfileSelection
} from './constants'
import { userProfileImageOperations } from './profileImageCollection'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { classOperations } from '@/services/groups/classes/operations'
import { feideEmailDomainsTrustedAsVerified } from '@/lib/feide/constants'
import { sendVerifyEmail } from '@/lib/email/systemMail/verifyEmail'
import { sendEmailChangedMail } from '@/lib/email/systemMail/emailChanged'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { sendUserInvitationEmail } from '@/lib/email/systemMail/userInvitation'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { invalidateOneUserSessionData } from '@/services/auth/invalidateSession'
import { getMembershipFilter } from '@/auth/getMembershipFilter'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { decryptAndComparePassword, hashAndEncryptPassword } from '@/auth/passwordHash'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import crypto from 'node:crypto'
import type { UserPagingReturn, UserPartition } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'

export const userOperations = {
    /**
     * Creates a user by invitation, and sends the invitation email.
     * WARNING: This should not be used to create users registered by Feide.
     */
    create: defineOperation({
        dataSchema: userSchemas.data.create,
        authorizer: () => userAuth.create,
        operation: async ({ prisma, data }) => {
            const omegaMembership = await omegaMembershipGroupOperations.read({
                params: { omegaMembershipLevel: 'DEN_GEMENE_HOB' },
                bypassAuth: true,
            })
            const omegaOrder = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            const user = await prisma.user.create({
                data: {
                    ...data,
                    bioParagraph: { create: {} },
                    memberships: {
                        create: [{
                            groupId: omegaMembership.groupId,
                            order: omegaOrder.order,
                            admin: false,
                            active: true,
                        }]
                    },
                    ledgerAccount: {
                        create: { type: 'USER' },
                    },
                },
                select: userPrivateSelection
            })

            // Not awaited: the user exists either way, and the response must not wait on the mail
            // server. sendUserInvitationEmail never throws, it logs a failure. The tests create users
            // by the dozen, and the mail handler of a test run has no account to send from.
            if (process.env.NODE_ENV !== 'test') {
                void sendUserInvitationEmail(user)
            }

            return user
        }
    }),

    read: defineOperation({
        paramsSchema: userSchemas.params.read,
        authorizer: ({ params }) => userAuth.read.data({ userField: params }),
        operation: async ({ prisma, params }) => await prisma.user.findUniqueOrThrow({
            where: {
                id: params.id,
                ...params,
                ...userPartitions.unarchived,
            },
            select: userPrivateSelection
        })
    }),

    readBasic: defineOperation({
        paramsSchema: userSchemas.params.readBasic,
        authorizer: ({ params }) => userAuth.readBasic.data({ userField: params }),
        operation: async ({ prisma, params }) => await prisma.user.findUniqueOrThrow({
            where: {
                id: params.id,
                ...params,
                ...userPartitions.unarchived,
            },
            select: userBasicSelection
        })
    }),

    readOrNull: defineOperation({
        paramsSchema: userSchemas.params.readOrNull,
        authorizer: ({ params }) => userAuth.readOrNull.data({ userField: params }),
        operation: async ({ prisma, params }) => await prisma.user.findUnique({
            where: {
                id: params.id, // This is a bit wierd, but now ts is satisfied.
                ...params,
                ...userPartitions.unarchived,
            },
            select: userPrivateSelection
        })
    }),

    /**
     * Everything the profile page of a user shows: the user, the groups they are in, their class and
     * their omega membership.
     */
    readProfile: defineOperation({
        paramsSchema: userSchemas.params.readProfile,
        authorizer: ({ params }) => userAuth.readProfile.data({ userField: { username: params.username } }),
        operation: async ({ prisma, params }) => {
            const { id: userId } = await prisma.user.findUniqueOrThrow({
                where: { username: params.username.toLowerCase(), ...userPartitions.unarchived },
                select: { id: true },
            })

            const omegaMembership = await omegaMembershipGroupOperations.readUserLevel({
                params: {
                    userId
                },
                bypassAuth: true,
            })

            const defaultProfileImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })
            const user = await prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: {
                    ...userProfileSelection,
                    bioParagraph: true,
                    image: { include: expandedImageIncluder },
                },
            }).then(userData => ({
                ...userData,
                image: userData.image ?? defaultProfileImage,
            }))

            const [committeeMemberships, studyProgrammeMemberships, interestGroupMemberships] = await Promise.all([
                prisma.membership.findMany({
                    where: { userId, group: { groupType: 'COMMITTEE' } },
                    select: {
                        title: true,
                        order: true,
                        active: true,
                        group: { select: { committee: { select: { name: true, shortName: true } } } },
                    },
                    orderBy: { order: 'desc' },
                }),
                prisma.membership.findMany({
                    where: { userId, active: true, group: { groupType: 'STUDY_PROGRAMME' } },
                    select: {
                        groupId: true,
                        order: true,
                        group: { select: { studyProgramme: { select: { id: true, name: true, code: true } } } },
                    },
                }),
                prisma.membership.findMany({
                    where: { userId, active: true, group: { groupType: 'INTEREST_GROUP' } },
                    select: {
                        title: true,
                        order: true,
                        group: { select: { interestGroup: { select: { id: true, name: true } } } },
                    },
                    orderBy: { order: 'desc' },
                }),
            ])

            const committees = committeeMemberships.flatMap(({ group: { committee }, ...membership }) =>
                (committee ? [{ ...membership, committee }] : [])
            )

            const groups = {
                committeeMemberships: {
                    active: committees.filter(membership => membership.active),
                    historical: committees.filter(membership => !membership.active),
                },
                activeStudyProgrammes: studyProgrammeMemberships.flatMap(({ group: { studyProgramme }, ...membership }) =>
                    (studyProgramme ? [{ ...membership, studyProgramme }] : [])
                ),
                activeInterestGroups: interestGroupMemberships.flatMap(({ group: { interestGroup }, ...membership }) =>
                    (interestGroup ? [{ ...membership, interestGroup }] : [])
                ),
            }

            const userClass = await classOperations.readClassOfUser({
                params: {
                    userId
                },
                bypassAuth: true,
            })

            return { user, groups, class: userClass, omegaMembership }
        }
    }),

    /**
     * A page of the user list, filtered by name and group memberships. The users carry their class,
     * study programme and omega membership, and their title and admin flag in the selected group.
     * Covers the active omega students only, see userPartitions.
     */
    readPage: defineOperation({
        paramsSchema: userSchemas.params.readPage,
        authorizer: () => userAuth.readPage,
        operation: ({ prisma, params }) => readUserPage(prisma, params, 'activeOmegaStudents'),
    }),

    /**
     * A page of the user list as readPage, but covering everyone who is not archived, for admins
     * and for server code.
     */
    readUnarchivedPage: defineOperation({
        paramsSchema: userSchemas.params.readUnarchivedPage,
        authorizer: () => userAuth.readUnarchivedPage,
        operation: ({ prisma, params }) => readUserPage(prisma, params, 'unarchived'),
    }),

    /**
     * A page of the archived users, as readPage lists the active omega students.
     */
    readArchivedPage: defineOperation({
        paramsSchema: userSchemas.params.readArchivedPage,
        authorizer: () => userAuth.readArchivedPage,
        operation: ({ prisma, params }) => readUserPage(prisma, params, 'archived'),
    }),

    /**
     * The user half of the global search: the few users best matching a free text query, for a
     * search box to show while the user types. Every word of the query must occur in some part of
     * the name of the user, so that "ola nor" finds "Ola Nordmann".
     */
    search: defineOperation({
        paramsSchema: userSchemas.params.search,
        authorizer: () => userAuth.search,
        operation: async ({ prisma, params }) => {
            const words = params.query.split(/\s+/).filter(Boolean)

            const users = await prisma.user.findMany({
                take: params.limit ?? defaultSearchResultLimit,
                select: {
                    id: true,
                    username: true,
                    firstname: true,
                    lastname: true,
                    image: { include: expandedImageIncluder },
                },
                where: {
                    AND: [userPartitions.activeOmegaStudents, ...words.map((word): Prisma.UserWhereInput => ({
                        OR: [
                            { firstname: { contains: word, mode: 'insensitive' } },
                            { lastname: { contains: word, mode: 'insensitive' } },
                            { username: { contains: word, mode: 'insensitive' } },
                        ],
                    }))],
                },
                orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }],
            })

            const defaultProfileImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })

            return users.map(user => ({ ...user, image: user.image ?? defaultProfileImage }))
        }
    }),

    connectStudentCard: defineOperation({
        paramsSchema: userSchemas.params.connectStudentCard,
        dataSchema: userSchemas.data.connectStudentCard,
        authorizer: ({ params }) => userAuth.connectStudentCard.data({ userId: params.id }),
        operation: async ({ prisma, params, data }) => {
            await prisma.user.update({
                where: { id: params.id },
                data,
            })
        }
    }),

    update: defineOperation({
        paramsSchema: userSchemas.params.update,
        dataSchema: userSchemas.data.update,
        authorizer: () => userAuth.update,
        operation: ({ prisma, params, data }) => prisma.user.update({
            where: params,
            data,
        })
    }),

    updateProfile: defineOperation({
        paramsSchema: userSchemas.params.updateProfile,
        dataSchema: userSchemas.data.updateProfile,
        authorizer: ({ params }) => userAuth.updateProfile.data({ userField: { username: params.username } }),
        operation: ({ prisma, data, params }) => prisma.user.update({
            where: params,
            data,
        })
    }),

    updateTheme: defineOperation({
        paramsSchema: userSchemas.params.updateTheme,
        dataSchema: userSchemas.data.updateTheme,
        authorizer: ({ params }) => userAuth.updateTheme.data({ userField: { username: params.username } }),
        operation: async ({ prisma, params, data }) => {
            if (crypto
                .createHash('sha256')
                .update(params.username).digest('hex')
                ===
                '3555f1fbc3fbb263aa8363a3d142e1ee57fcf53cf862b4288d31532d98495321') {
                return await prisma.user.update({
                    where: { username: params.username },
                    data: {
                        ...data,
                        theme: 'LIGHT',
                    }
                })
            }
            return await prisma.user.update({
                where: { username: params.username },
                data,
            })
        }
    }),

    updateBioParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: userSchemas.params.updateBioParagraphContent,
        authorizer: ({ implementationParams }) =>
            userAuth.updateBioParagraphContent.data({ userId: implementationParams.userId }),
        ownershipCheck: async ({ prisma, implementationParams, params }) =>
            (await prisma.user.findUniqueOrThrow({
                where: { id: implementationParams.userId },
                select: { bioParagraphId: true },
            })).bioParagraphId === params.paragraphId,
    }),

    updatePassword: defineOperation({
        paramsSchema: userSchemas.params.updatePassword,
        dataSchema: userSchemas.data.updatePassword,
        authorizer: ({ params }) => userAuth.updatePassword.data({ userId: params.id }),
        operation: async ({ prisma, data, params }) => {
            const passwordHash = await hashAndEncryptPassword(data.password)

            await prisma.user.update({
                where: { id: params.id },
                data: {
                    sessionEpoch: { increment: 1 },
                    // A migrated or invited user gets their first password through a reset.
                    credentials: { upsert: { create: { passwordHash }, update: { passwordHash } } },
                },
            })

            return null
        }
    }),

    registerNewEmail: defineOperation({
        paramsSchema: userSchemas.params.registerNewEmail,
        authorizer: ({ params }) => userAuth.registerNewEmail.data({ userId: params.id }),
        dataSchema: userSchemas.data.registerNewEmail,
        operation: async ({ prisma, params, data }) => {
            const storedUser = await prisma.user.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    ...userBasicSelection,
                    email: true,
                    emailVerified: true,
                    acceptedTerms: true,
                    feideAccount: {
                        select: {
                            email: true,
                        }
                    }
                }
            })

            // Used both to set the email during sign-up and to change it afterwards.
            if (data.email === storedUser.email && storedUser.emailVerified) {
                return {
                    verified: true,
                    email: data.email,
                }
            }

            // Password resets go to the email, so a registered user must give their password to change
            // it. A user still signing up is not asked, since /register sets the password anyway.
            const credentials = await prisma.credentials.findUnique({
                where: { userId: params.id },
                select: { passwordHash: true },
            })
            if (credentials && storedUser.acceptedTerms && !(
                data.currentPassword && await decryptAndComparePassword(data.currentPassword, credentials.passwordHash)
            )) {
                throw new ServiceError('BAD PARAMETERS', 'Feil passord.')
            }

            const emailDomain = data.email.split('@').pop() ?? ''
            if (
                data.email === storedUser.feideAccount?.email &&
                feideEmailDomainsTrustedAsVerified.includes(emailDomain)
            ) {
                const updatedUser = await prisma.user.update({
                    where: {
                        id: params.id,
                    },
                    data: {
                        email: data.email,
                        emailVerified: (new Date()).toISOString()
                    },
                    select: { ...userBasicSelection, email: true },
                })
                await sendEmailChangedMail(updatedUser, storedUser.email)

                return {
                    verified: true,
                    email: data.email,
                }
            }

            await sendVerifyEmail(storedUser, data.email)

            return {
                verified: false,
                email: data.email,
            }
        }
    }),

    /**
     * Completes the last step of user creation: registration. This can only be done once per user.
     */
    register: defineOperation({
        paramsSchema: userSchemas.params.register,
        dataSchema: userSchemas.data.register,
        authorizer: ({ params }) => userAuth.register.data({ userId: params.id }),
        opensTransaction: true,
        operation: async ({ prisma, data, params }) => {
            const { sex, password, allergies, imageConsent } = data

            const passwordHash = await hashAndEncryptPassword(password)

            // Everything registration writes stands or falls together, so a failure part of the way
            // leaves the user unregistered and free to try again, not registered with half of it.
            return await prisma.$transaction(async tx => {
                const storedUser = await tx.user.findUniqueOrThrow({
                    where: {
                        id: params.id,
                    },
                    select: {
                        acceptedTerms: true,
                        emailVerified: true,
                    },
                })

                if (storedUser.acceptedTerms) throw new ServiceError('DUPLICATE', 'Brukeren er allerede registrert.')

                if (!storedUser.emailVerified) {
                    throw new ServiceError('DISSALLOWED', 'Du må bekrefte e-posten din før du kan registrere deg.')
                }

                const registeredUser = await tx.user.update({
                    where: {
                        id: params.id,
                    },
                    data: {
                        acceptedTerms: new Date(),
                        imageConsent,
                        sex,
                        allergies,
                    },
                    select: userPrivateSelection
                })

                await tx.credentials.upsert({
                    where: {
                        userId: params.id,
                    },
                    create: {
                        user: {
                            connect: {
                                id: params.id,
                            },
                        },
                        passwordHash,
                    },
                    update: {
                        passwordHash,
                    },
                })

                // Skips the channels the user is already subscribed to, which a user whose accepted
                // terms were reset has kept.
                await notificationSubscriptionOperations.createDefault.internalCall({
                    params: {
                        userId: params.id,
                    },
                    prisma: tx,
                })

                // What someone studies is what decides where they come in; anything above that is
                // earned through the admission system, so this only ever moves a user up.
                const inferredLevel = await omegaMembershipGroupOperations.inferUserLevel({
                    params: {
                        userId: params.id,
                    },
                    prisma: tx,
                    bypassAuth: true,
                })

                await omegaMembershipGroupOperations.writeUserLevel.internalCall({
                    params: {
                        userId: params.id,
                        omegaMembershipLevel: inferredLevel,
                        onlyUpgrade: true,
                    },
                    prisma: tx,
                })
                await invalidateOneUserSessionData(tx, params.id)

                return registeredUser
            })
        }
    }),

    readUserWithBalance: defineOperation({
        authorizer: async ({ params, prisma }) => userAuth.readUserWithBalance.data({
            userField: {
                id: (await prisma.user.findFirst({
                    where: { ...params, ...userPartitions.unarchived },
                    select: { id: true },
                }))?.id,
            },
        }),
        paramsSchema: userSchemas.params.readUserWithBalance,
        operation: async ({ prisma, params }) => {
            const user = await prisma.user.findFirstOrThrow({
                where: { ...params, ...userPartitions.unarchived },
                select: {
                    ...userBasicSelection,
                    image: { include: expandedImageIncluder },
                }
            })

            user.image ??= await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })

            // bypassAuth: userAuth.readUserWithBalance above already applies the ledger's rule (the
            // user themselves or LEDGER_ADMIN); ledgerAccountAuth.read/calculateBalance's own check would
            // otherwise reject an API-key caller (no session user) looking up someone else's
            // balance.
            const account = await ledgerAccountOperations.read({
                params: { userId: user.id },
                bypassAuth: true,
            })
            const balance = await ledgerAccountOperations.calculateBalance({
                params: { ledgerAccountId: account.id },
                bypassAuth: true,
            })

            return {
                balance: balance.amount,
                user,
            }
        }
    }),

    //TODO: Make soft delete?
    /**
     * Deletes a user from the database, together with the bio paragraph only they owned.
     */
    destroy: defineOperation({
        paramsSchema: userSchemas.params.destroy,
        authorizer: () => userAuth.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            await prisma.$transaction(async tx => {
                const user = await tx.user.delete({
                    where: {
                        id: params.id,
                    },
                    select: { bioParagraphId: true },
                })
                await cmsParagraphOperations.destroy.internalCall({
                    prisma: tx,
                    params: { paragraphId: user.bioParagraphId },
                })
            })
        }
    }),

    /**
     * Shuts the user out of the site: they can no longer log in, their sessions end on their next
     * request, and no read of users covers them unless it asks for the archived ones. Their data
     * stays, so an admin can let them back in with unarchive.
     */
    archive: defineOperation({
        paramsSchema: userSchemas.params.archive,
        authorizer: ({ params }) => userAuth.archive.data({ userId: params.id }),
        operation: async ({ prisma, params }) => {
            await prisma.user.update({
                where: { id: params.id, ...userPartitions.unarchived },
                data: { archived: true },
            })
        }
    }),

    unarchive: defineOperation({
        paramsSchema: userSchemas.params.unarchive,
        authorizer: () => userAuth.unarchive,
        operation: async ({ prisma, params }) => {
            await prisma.user.update({
                where: { id: params.id, ...userPartitions.archived },
                data: { archived: false },
            })
        }
    }),

    updateProfileImage: defineOperation({
        authorizer: ({ params }) => userAuth.updateProfileImage.data({ userField: { username: params.username } }),
        paramsSchema: userSchemas.params.updateProfileImage,
        dataSchema: userSchemas.data.updateProfileImage,
        opensTransaction: true,
        // uploadImage resizes to 3 sizes, converts to avif and writes several files to store
        // before any db write happens - comfortably slower than the default 5000ms interactive
        // transaction timeout under load, hence the raised timeout below.
        operation: async ({ prisma, params, data }) => {
            const { image: newImage, cleanup } = await prisma.$transaction(async tx => {
                const existingUser = await tx.user.findUniqueOrThrow({
                    where: { username: params.username },
                })

                const uploadedImage = await userProfileImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: data.imageFile,
                        imageName: 'Profilbilde',
                        imageAlt: `Profilbilde av ${existingUser.firstname} ${existingUser.lastname}`.slice(0, 100),
                    },
                })

                await tx.user.update({
                    where: { id: existingUser.id },
                    data: {
                        image: {
                            connect: { id: uploadedImage.id }
                        }
                    }
                })

                // A previous imageId is always an upload owned 1:1 by this user (never the shared
                // default, since that's only ever resolved at read time) - safe to destroy.
                const fileCleanup = existingUser.imageId
                    ? await userProfileImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: existingUser.imageId }
                    })
                    : async () => { }

                return { image: uploadedImage, cleanup: fileCleanup }
            }, { timeout: 20000 })
            await cleanup()
            return newImage
        }
    }),
} as const

type ReadUserPageParams = z.infer<typeof userSchemas.params.readPage>

async function readUserPage(
    prisma: Prisma.TransactionClient,
    params: ReadUserPageParams,
    partition: UserPartition,
): Promise<UserPagingReturn[]> {
    const { page, details } = params.paging
    const words = details.partOfName.split(' ')
    const sortDirection = details.sort?.direction ?? 'asc'
    // The username is always included as the final tiebreaker so the
    // ordering stays fully deterministic for cursor-based pagination.
    const orderBy = details.sort?.field === 'username' ? [
        { username: sortDirection },
        { lastname: sortDirection },
        { firstname: sortDirection },
    ] : [
        { lastname: sortDirection },
        { firstname: sortDirection },
        { username: sortDirection },
    ]

    if (details.groups.length > maxNumberOfGroupsInFilter) {
        throw new ServiceError('BAD PARAMETERS', 'Too many groups in filter')
    }
    const groupSelection = details.selectedGroup ? [
        getMembershipFilter(details.selectedGroup.groupOrder, details.selectedGroup.groupId)
    ] : []

    const groups = [...details.groups, ...(details.selectedGroup ? [details.selectedGroup] : [])]

    const users = await prisma.user.findMany({
        ...cursorPagingSelection(page),
        select: {
            ...userCardSelection,
            memberships: {
                select: {
                    admin: true,
                    title: true,
                    groupId: true,
                    group: {
                        select: {
                            class: { select: { level: true } },
                            studyProgramme: { select: { code: true } },
                            omegaMembershipGroup: { select: { omegaMembershipLevel: true } }
                        }
                    }
                },
                where: {
                    OR: [
                        {
                            AND: [
                                {
                                    OR: standardMembershipSelection,
                                },
                                getMembershipFilter('ACTIVE')
                            ]
                        },
                        {
                            OR: groupSelection
                        }
                    ]

                }
            },
        },
        where: {
            AND: [
                userPartitions[partition],
                ...words.map((word, index) => {
                    const condition = {
                        [index === words.length - 1 ? 'contains' : 'equals']: word,
                        mode: 'insensitive'
                    } as const
                    return {
                        OR: [
                            { firstname: condition },
                            { lastname: condition },
                            { username: condition },
                        ],
                    }
                }),
                ...groups.map(group => ({
                    memberships: {
                        some: {
                            ...getMembershipFilter(group.groupOrder, group.groupId),
                        }
                    }
                }))
            ],
        },
        // We have to sort with at least one unique field to have a
        // consistent order. Sorting rows by fieds that have the same
        // value is undefined behaviour in postgresql.
        orderBy
    })
    return users.map(user => {
        const clas = user.memberships.find(
            membership => membership.group.class !== null)?.group.class?.level
        const studyProgramme = user.memberships.find(
            membership => membership.group.studyProgramme !== null)?.group.studyProgramme?.code
        const membershipType = user.memberships.find(
            membership =>
                membership.group.omegaMembershipGroup !== null
        )?.group.omegaMembershipGroup?.omegaMembershipLevel
        const title = user.memberships.find(
            membership => membership.groupId === details.selectedGroup?.groupId)?.title
        const admin = user.memberships.find(
            membership => membership.groupId === details.selectedGroup?.groupId)?.admin
        return {
            ...user,
            class: clas,
            studyProgramme,
            membershipType,
            selectedGroupInfo: {
                title,
                admin
            }
        }
    })
}
