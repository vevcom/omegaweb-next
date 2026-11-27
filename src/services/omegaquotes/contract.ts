import { omegaquoteDataFieldSchemas, omegaquoteParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { defineContract } from '@/services/serviceContract'
import { z } from 'zod'

export const omegaquoteContract = defineContract({
    create: {
        params: omegaquoteParamsFieldSchemas.pick({
            userPosterId: true,
        }),
        data: omegaquoteDataFieldSchemas.pick({
            quote: true,
            author: true,
        }),
        authorizer: Require.userId().permission('OMEGAQUOTES_USE'),
    },
    readPage: {
        params: readPageInputSchemaObject(
            omegaquoteParamsFieldSchemas.pick({
                id: true,
            }),
            z.undefined(),
        ),
        authorizer: Require.permission('OMEGAQUOTES_USE'),
    },
})
