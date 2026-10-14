import type { Prisma } from '@/prisma-generated-pn-types'

export const lockerReservationIncluder = {
    LockerReservation: {
        where: {
            active: true
        },
        select: {
            id: true,
            endDate: true,
            group: {
                include: {
                    class: true,
                    committee: true,
                    interestGroup: true,
                    manualGroup: true,
                    omegaMembershipGroup: true,
                    studyProgramme: true
                }
            },
            user: {
                select: {
                    id: true,
                    firstname: true,
                    lastname: true
                }
            }
        }
    }
} satisfies Prisma.LockerInclude
