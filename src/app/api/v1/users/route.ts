import '@pn-server-only'
import { apiHandler } from '@/api/apiHandler'
import { userOperations } from '@/services/users/operations'
import { ServiceError } from '@/services/error'

export const GET = apiHandler({
    serviceOperation: userOperations.readUserWithBalance,
    query: searchParams => {
        const studentCard = searchParams.get('studentCard')

        if (!studentCard) {
            throw new ServiceError('BAD PARAMETERS', 'studentCard is required.')
        }

        return { studentCard }
    },
})

export const POST = apiHandler({
    serviceOperation: userOperations.create
})
