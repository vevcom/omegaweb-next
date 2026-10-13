import { createSelection } from '@/services/createSelection'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { schoolSchemas } from './schemas'
import type { z } from 'zod'
import type { Prisma, School, StandardSchool } from '@/prisma-generated-pn-types'

export const StandardSchoolsConfig = {
    NTNU: {
        name: 'Norges tekniske og naturvitenskapelige universitet',
        shortName: 'NTNU',
    }
} as const satisfies Record<StandardSchool, Pick<z.infer<typeof schoolSchemas.data.create>, 'name' | 'shortName'>>

export const SchoolFieldsToExpose = [
    'name',
    'shortName',
    'id',
    'desctiption',
] as const satisfies (keyof School)[]

export const SchoolFilteredSelection = createSelection(SchoolFieldsToExpose)

export const SchoolRelationIncluder = {
    cmsImage: {
        include: {
            image: { include: expandedImageIncluder },
        }
    },
    cmsParagraph: true,
    cmsLink: true,
} satisfies Prisma.SchoolInclude
