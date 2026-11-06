import type { Prisma } from '@/prisma-generated-pn-types'
import type { revueGroupMemberIncluder } from './constants'

export type RevueGroupMemberWithUser = Prisma.RevueGroupMemberGetPayload<{
    include: typeof revueGroupMemberIncluder
}>

/** The name is the one of the user for a member of type USER. */
export type ExpandedRevueGroupMember = Omit<RevueGroupMemberWithUser, 'name'> & { name: string }
