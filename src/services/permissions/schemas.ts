import { permissionsAllowedAsDefault } from './constants'
import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import { zfd } from 'zod-form-data'

const dataFieldSchemas = z.object({
    // The default permissions form posts one checkbox per permission, so none or a single one arrives
    // as no value or a lone string rather than an array.
    permissions: zfd.repeatable(z.nativeEnum(Permission).array()),
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
        }).refine(
            ({ permissions }) => permissions.every(permission => permissionsAllowedAsDefault().includes(permission)),
            'Noen av tilgangene kan ikke være standardtilganger.'
        ),
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
