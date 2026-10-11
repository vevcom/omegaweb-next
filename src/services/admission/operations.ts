import '@pn-server-only'
import { admissionSchemas } from './schemas'
import { admissionAuth } from './auth'
import { userBasicSelection } from '@/services/users/constants'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { omegaMembershipGroupOperations, writeUserLevel } from '@/services/groups/omegaMembershipGroups/operations'
import { invalidateOneUserSessionData } from '@/services/auth/invalidateSession'
import { Admission } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import type { ExpandedAdmissionTrail } from './types'

export const admissionOperations = {
    readTrial: defineOperation({
        paramsSchema: admissionSchemas.readTrial,
        authorizer: ({ params }) => admissionAuth.readTrial.data({ userId: params.userId }),
        operation: async ({ prisma, params: { userId } }) => await prisma.admissionTrial.findMany({
            where: {
                userId,
            }
        })
    }),

    /**
     * Whether the user has sat every admission trial there is, which is what earns them their place
     * as a sysken. A user holds at most one trial per admission, so counting them is enough.
     */
    userCompletedTrials: defineOperation({
        paramsSchema: admissionSchemas.userCompletedTrials,
        authorizer: ({ params }) => admissionAuth.userCompletedTrials.data({ userId: params.userId }),
        operation: async ({ prisma, params: { userId } }): Promise<boolean> => {
            const trials = await prisma.admissionTrial.count({
                where: {
                    userId,
                }
            })
            return trials >= Object.keys(Admission).length
        }
    }),
    /**
     * Registers that the user has sat the given trial, and makes them a sysken once that was the
     * last one they had left.
     *
     * Only a soelle sits trials: den gemene hob has not been let in to start their admission, and a
     * sysken has already finished it. Anyone else is therefore turned away rather than quietly
     * given a trial that would never add up to anything.
     */
    createTrial: defineOperation({
        authorizer: () => admissionAuth.createTrial,
        paramsSchema: z.object({
            admission: z.nativeEnum(Admission),
        }),
        dataSchema: admissionSchemas.createTrial,
        opensTransaction: true,
        operation: async ({ prisma, session, params, data }): Promise<ExpandedAdmissionTrail> => {
            // Read before the transaction is opened: a user whose omega memberships are in a broken
            // state is put right first, and that writes.
            const omegaMembership = await omegaMembershipGroupOperations.readUserLevel({
                params: {
                    userId: data.userId
                },
                bypassAuth: true,
            })

            if (omegaMembership.level !== 'SOELLE') {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Opptaksprøver kan kun registreres for en soelle.'
                )
            }

            // The trial and the promotion it earns are written together. Were the promotion to fail
            // on its own, the user would be left holding every trial as a soelle - and unable to be
            // put right by sitting the last one again, since they already hold it.
            const { results, becameSysken } = await prisma.$transaction(async tx => {
                const trial = await tx.admissionTrial.create({
                    data: {
                        user: {
                            connect: {
                                id: data.userId,
                            },
                        },
                        registeredBy: {
                            connect: {
                                id: session.user?.id,
                            },
                        },
                        admission: params.admission,
                    },
                    include: {
                        user: {
                            select: userBasicSelection,
                        }
                    }
                })

                // Counted on the same client, so that the trial just written is counted with them.
                const completedTrials = await admissionOperations.userCompletedTrials({
                    params: {
                        userId: data.userId
                    },
                    prisma: tx,
                    bypassAuth: true,
                })

                if (completedTrials) {
                    await writeUserLevel(tx, {
                        userId: data.userId,
                        omegaMembershipLevel: 'SYSKEN',
                        onlyUpgrade: true,
                    })
                }

                return { results: trial, becameSysken: completedTrials }
            })

            if (becameSysken) {
                await invalidateOneUserSessionData(prisma, data.userId)
            }

            return results
        }
    }),
} as const
