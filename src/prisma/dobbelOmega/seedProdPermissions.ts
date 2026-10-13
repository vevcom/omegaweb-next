import { checkForPermissionDuplicates, COMMITTEE_PERMISSIONS } from '@/seeder/src/permissions'
import { Permission } from '@/prisma-generated-pn-types'
import logger from '@/lib/logger'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'

export default async function seedProdPermissions(prisma: PrismaClientPn) {
    const allPermissions = Object.values(Permission)

    const committeePermissions: Record<string, Permission[]> = {
        vevcom: allPermissions,
        hs: allPermissions,
        ombul: [
            'OMBUL_USE',
            'OMBUL_ADMIN',
            'BULLSHIT_USE',
        ],
        hyttecom: [
            'CABIN_ADMIN',
        ],
        contactor: [
            'DOTS_ADMIN',
            'SCREEN_USE',
            'SCREEN_ADMIN',
        ],
    }


    const allCommittess = await prisma.committee.findMany()

    for (const [shortName, permissions] of Object.entries(committeePermissions)) {
        checkForPermissionDuplicates(permissions, `${shortName} permissions`)

        const committee = allCommittess.find(com => com.shortName === shortName)
        if (!committee) {
            logger.warn(`Committee with shortName ${shortName} not found, skipping permissions creation.`)
        }
    }

    for (const committee of allCommittess) {
        let permissions: Permission[] = committeePermissions[committee.shortName] ?? []
        permissions = permissions.concat(COMMITTEE_PERMISSIONS)
        permissions = permissions.filter((perm, index) => permissions.indexOf(perm) === index)

        await prisma.groupPermission.createMany({
            data: permissions.map(perm => ({
                permission: perm,
                groupId: committee.groupId
            }))
        })
    }
}

