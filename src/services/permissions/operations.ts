import '@pn-server-only'
import { permissionsAuth } from './auth'
import { permissionSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { invalidateAllUserSessionData, invalidateManyUserSessionData } from '@/services/auth/invalidateSession'
import { groupsWithRelationsIncluder } from '@/services/groups/constants'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import type { Permission } from '@/prisma-generated-pn-types'


export const permissionOperations = {
    readDefaultPermissions: defineOperation({
        authorizer: () => permissionsAuth.readDefaultPermissions,
        operation: async ({ prisma }) =>
            (await prisma.defaultPermission.findMany()).map(perm => perm.permission)
    }),

    readPermissionsOfUser: defineOperation({
        authorizer: ({ params }) => permissionsAuth.readPermissionsOfUser.data({ userId: params.userId }),
        paramsSchema: permissionSchemas.params.readPermissionsOfUser,
        operation: async ({ prisma, params }) => {
            const [defaultPermissions, groupPermissions] = await Promise.all([
                permissionOperations.readDefaultPermissions({}),
                prisma.membership.findMany({
                    where: {
                        userId: params.userId,
                        active: true,
                    },
                    select: {
                        group: {
                            select: {
                                permissions: true
                            }
                        }
                    }
                })
            ])


            const groupPermsFlatten = groupPermissions.map(group =>
                group.group.permissions.map(permission => permission.permission)
            ).flat()
            const ret: Permission[] = defaultPermissions.concat(groupPermsFlatten)

            return ret.filter((permission, i) => ret.indexOf(permission) === i)
        }
    }),

    readPermissionsOfGroup: defineOperation({
        authorizer: () => permissionsAuth.readPermissionsOfGroup,
        paramsSchema: permissionSchemas.params.readPermissionsOfGroup,
        operation: async ({ prisma, params }) => (await prisma.groupPermission.findMany({
            where: {
                groupId: params.groupId
            }
        })).map(permission => permission.permission)
    }),

    readPermissionMatrix: defineOperation({
        authorizer: () => permissionsAuth.readPermissionMatrix,
        operation: async ({ prisma }) => {
            const groupsPermission = await prisma.group.findMany({
                include: {
                    ...groupsWithRelationsIncluder,
                    permissions: true
                }
            })

            return groupsPermission.map(group => ({
                ...group,
                name: inferGroupName(assertGroupValidity(group)),
                permissions: group.permissions.map(permission => permission.permission)
            }))
        }
    }),

    updateDefaultPermissions: defineOperation({
        authorizer: () => permissionsAuth.updateDefaultPermissions,
        dataSchema: permissionSchemas.data.updateDefaultPermissions,
        opensTransaction: true,
        operation: ({ prisma, data }) => prisma.$transaction(async tx => {
            await tx.defaultPermission.deleteMany({
                where: {
                    permission: {
                        notIn: data.permissions,
                    },
                },
            })

            await tx.defaultPermission.createMany({
                data: data.permissions.map(permission => ({
                    permission,
                })),
                skipDuplicates: true,
            })

            // Every session holds the default permissions, so every one of them is now stale.
            await invalidateAllUserSessionData(tx)

            return data.permissions
        })
    }),

    updateGroupPermission: defineOperation({
        authorizer: () => permissionsAuth.updateGroupPermission,
        paramsSchema: permissionSchemas.params.updateGroupPermission,
        dataSchema: permissionSchemas.data.updateGroupPermission,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            if (data.value) {
                await tx.groupPermission.create({
                    data: {
                        groupId: params.groupId,
                        permission: params.permission,
                    },
                })
            } else {
                await tx.groupPermission.delete({
                    where: {
                        groupId_permission: {
                            groupId: params.groupId,
                            permission: params.permission,
                        }
                    },
                })
            }

            const group = await tx.group.findUniqueOrThrow({
                where: {
                    id: params.groupId
                },
                select: {
                    memberships: {
                        select: {
                            userId: true,
                        },
                        where: {
                            active: true,
                        }
                    }
                }
            })

            const userIds = group.memberships.map(membership => membership.userId)
            await invalidateManyUserSessionData(tx, userIds)

            return data.value
        })
    }),
} as const
