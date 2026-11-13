import '@pn-server-only'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

export type ReadUserIdsOfChatSpace = (args: {
    prisma: PrismaPossibleTransaction<false>,
    spaceId: number,
}) => Promise<number[]>

type ByPurpose = Partial<Record<ChatSpacePurpose, ReadUserIdsOfChatSpace>>

/**
 * Who administers a space, read by the service that owns spaces of its purpose. The chat sync asks
 * on every run, so nobody is stored as an admin. A purpose not here has no admins.
 */
export const chatSpaceAdmins: ByPurpose = {}

/**
 * Whom a space has as members without anyone adding them, such as the active members of a
 * committee. The chat sync gives each a member row on every run, and takes none away when they are
 * named no longer. A purpose not here has only the members it is given.
 */
export const chatSpaceStandingMembers: ByPurpose = {}
