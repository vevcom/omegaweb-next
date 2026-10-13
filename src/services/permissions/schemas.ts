import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    permissions: z.nativeEnum(Permission).array(),
    value: z.boolean(),
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
    groupId: z.number(),
    permission: z.nativeEnum(Permission),
})

export const permissionSchemas = {
    data: {
        updateDefaultPermissions: dataFieldSchemas.pick({
            permissions: true,
        }),
        updateGroupPermission: dataFieldSchemas.pick({
            value: true,
        }),
    },
    params: {
        readPermissionsOfUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        readPermissionsOfGroup: paramsFieldSchemas.pick({
            groupId: true,
        }),
        updateGroupPermission: paramsFieldSchemas.pick({
            groupId: true,
            permission: true,
        }),
    },
}
