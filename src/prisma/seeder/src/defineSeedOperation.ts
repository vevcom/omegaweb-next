import { withServiceContext } from '@/services/serviceOperation'
import { Session } from '@/auth/session/Session'
import type { PrismaClient } from '@/prisma-generated-pn-client'

export function defineSeedOperation<ReturnType>(operation: (prisma: PrismaClient) => Promise<ReturnType>) {
    return () => withServiceContext(
        { bypassAuth: true, session: Session.empty() },
        'OPENS',
        async ({ prisma }) => operation(prisma)
    )
}
