import '@pn-server-only'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

/** Who administers a space, as the service that owns it decides: the ids of the users. */
export type ReadChatSpaceAdminUserIds = (args: {
    prisma: PrismaPossibleTransaction<false>,
    spaceId: number,
}) => Promise<number[]>

/**
 * How the admins of a space are read, by the purpose of the space, which is to say by the service
 * that owns it. A service that implements chat spaces adds its own here, beside its
 * `implementChatSpaces`. The chat sync asks on every run, so nobody is stored as an admin: a
 * committee's are whoever its admins are at the time. A purpose not here yet has no admins.
 */
export const chatSpaceAdmins: Partial<Record<ChatSpacePurpose, ReadChatSpaceAdminUserIds>> = {}
