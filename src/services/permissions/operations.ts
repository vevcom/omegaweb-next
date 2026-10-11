import '@pn-server-only'
import { permissionsAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { invalidateAllUserSessionData, invalidateManyUserSessionData } from '@/services/auth/invalidateSession'
import { groupsWithRelationsIncluder } from '@/services/groups/constants'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'


export const permissionOperations = {
    readDefaultPermissions: defineOperation({
        authorizer: () => permissionsAuth.readDefaultPermissions,
        operation: async ({ prisma }) =>
            (await prisma.defaultPermission.findMany()).map(perm => perm.permission)
    }),

    readPermissionsOfUser: defineOperation({
        authorizer: ({ params }) => permissionsAuth.readPermissionsOfUser.data({ userId: params.userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
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
        authorizer: () => permissionsAuth.readGroupPermissions,
        paramsSchema: z.object({
            groupId: z.number()
        }),
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
        dataSchema: z.object({
            permissions: z.nativeEnum(Permission).array(),
        }),
        operation: async ({ prisma, data }) => {
            await prisma.defaultPermission.deleteMany({
                where: {
                    permission: {
                        notIn: data.permissions,
                    },
                },
            })

            await prisma.defaultPermission.createMany({
                data: data.permissions.map(permission => ({
                    permission,
                })),
                skipDuplicates: true,
            })

            // Invalidate all user sessions
            await invalidateAllUserSessionData(prisma)

            return data.permissions
        }
    }),

    updateGroupPermission: defineOperation({
        authorizer: () => permissionsAuth.updateGroupPermission,
        paramsSchema: z.object({
            groupId: z.number(),
            permission: z.nativeEnum(Permission),
        }),
        dataSchema: z.object({
            value: z.boolean()
        }),
        operation: async ({ prisma, params, data }) => {
            if (data.value) {
                await prisma.groupPermission.create({
                    data: {
                        groupId: params.groupId,
                        permission: params.permission,
                    },
                })
            } else {
                await prisma.groupPermission.delete({
                    where: {
                        groupId_permission: {
                            groupId: params.groupId,
                            permission: params.permission,
                        }
                    },
                })
            }

            const group = await prisma.group.findUniqueOrThrow({
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
            await invalidateManyUserSessionData(prisma, userIds)

            return data.value
        }
    }),
} as const
