import { checkForPermissionDuplicates, COMMITTEE_PERMISSIONS } from '@/seeder/src/permissions'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { Permission } from '@/prisma-generated-pn-types'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { OmegaMembershipLevel } from '@/prisma-generated-pn-types'

/**
 * Seeds the default permissions, the permissions of each omega membership group, every permission
 * for Harambe's committee and the standard committee permissions for every committee.
 *
 * Development only - in any other environment permissions are managed through the admin pages, and
 * a seed that re-grants them on every run would undo revocations made there. Additive, so re-seeding
 * also grants permissions added since the last run.
 */
export const seedDevPermissions = defineSeedOperation(async (prisma: PrismaClient) => {
    const defaultPermissions: Permission[] = [
        'MANUAL_GROUP_USE',
        'CLASS_USE',
        'OMEGA_ORDER_USE',
        'JOBAD_USE',
        'SCHOOLS_USE',
        'COURSES_USE',
        'CABIN_USE',
        'LEDGER_USE',
    ]

    checkForPermissionDuplicates(defaultPermissions, 'default permissions')

    await prisma.defaultPermission.createMany({
        data: defaultPermissions.map(permission => ({ permission })),
        skipDuplicates: true,
    })

    const membershipPermissions: Record<OmegaMembershipLevel, Permission[]> = {
        SYSKEN: [
            'OMBUL_USE',
            'OMEGAQUOTES_USE',
            'COMMITTEE_USE',
            'INTEREST_GROUP_USE',
            'STUDY_PROGRAMME_USE',
            'LOCKER_USE',
            'PURCHASE_USE',
            'USERS_USE',
            'CLASS_USE',
            'OMEGA_MEMBERSHIP_GROUP_USE',
            'JOBAD_USE',
            'SCHOOLS_USE',
            'COURSES_USE',
            'COMPANY_USE',
            'CABIN_USE',
        ],
        SOELLE: [
            'OMBUL_USE',
            'OMEGAQUOTES_USE',
            'COMMITTEE_USE',
            'INTEREST_GROUP_USE',
            'STUDY_PROGRAMME_USE',
            'USERS_USE',
            'CLASS_USE',
            'OMEGA_MEMBERSHIP_GROUP_USE',
            'JOBAD_USE',
            'SCHOOLS_USE',
            'COURSES_USE',
            'COMPANY_USE',
            'CABIN_USE',
        ],
        DEN_GEMENE_HOB: []
    }

    const omegaMembershipGroups = await prisma.omegaMembershipGroup.findMany()

    await prisma.groupPermission.createMany({
        data: omegaMembershipGroups.flatMap(group => {
            const permissions = membershipPermissions[group.omegaMembershipLevel]
            checkForPermissionDuplicates(permissions, `${group.omegaMembershipLevel} permissions`)
            return permissions.map(permission => ({ permission, groupId: group.groupId }))
        }),
        skipDuplicates: true,
    })

    const harcom = await prisma.committee.findUniqueOrThrow({
        where: { shortName: 'harcom' },
    })

    await prisma.groupPermission.createMany({
        data: Object.values(Permission).map(permission => ({
            permission,
            groupId: harcom.groupId,
        })),
        skipDuplicates: true,
    })

    const allCommittees = await prisma.committee.findMany()

    await prisma.groupPermission.createMany({
        data: allCommittees.flatMap(committee => COMMITTEE_PERMISSIONS.map(permission => ({
            permission,
            groupId: committee.groupId,
        }))),
        skipDuplicates: true,
    })
})
