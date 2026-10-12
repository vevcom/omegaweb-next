import type {
    userBasicSelection,
    userCardSelection,
    userProfileSelection,
    userPrivateSelection
} from './constants'
import type { userSchemas } from './schemas'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { ClassLevel, OmegaMembershipLevel } from '@/prisma-generated-pn-types'
import type { Prisma } from '@/prisma-generated-pn-types'

export type UserBasic = Prisma.UserGetPayload<{ select: typeof userBasicSelection }>
export type UserCard = Prisma.UserGetPayload<{ select: typeof userCardSelection }>
export type UserProfile = Prisma.UserGetPayload<{ select: typeof userProfileSelection }>
export type UserFiltered = Prisma.UserGetPayload<{ select: typeof userPrivateSelection }>
export type UserBasicWithEmail = UserBasic & Pick<UserProfile, 'email'>

export type StandardMembeships = {
    class?: ClassLevel
    studyProgramme?: string
    membershipType?: OmegaMembershipLevel
}

export type UserPagingReturn = UserCard & StandardMembeships & {
    selectedGroupInfo?: {
        title?: string
        admin?: boolean
    }
}

/**
 * Groups is an array of group ids and order. They will be ANDed together.
 * PartOfName is a string that is part of the name of the user.
 * selectedGroup will also filter on that group, but will also return extra
 * info about that membership.
 */
export type UserDetails = InferPagingDetails<typeof userSchemas.readPage>

export type RegisterNewEmailType = {
    verified: boolean,
    email: string,
}

export type UserCursor = InferPagingCursor<typeof userSchemas.readPage>
