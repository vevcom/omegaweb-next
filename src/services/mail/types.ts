
import type { MailListTypeArray } from './constants'
import type { Group, MailAddressExternal, MailAlias, MailingList } from '@/prisma-generated-pn-types'
import type { UserBasic } from '@/services/users/types'

export type MailListTypes = typeof MailListTypeArray[number];

export type ViaType = {
    type: MailListTypes,
    id: number,
    label: string,
}

/**
 * How a node of the flow is reached from the one in focus: `direct` when it is connected straight
 * to it, and `via` lists each node it is reached through besides. A user on a list and in one of
 * its groups is both.
 */
export type MailFlowPaths = {
    direct: boolean,
    via: ViaType[],
}

/** An alias or a mailing list with whether the session passes its owner visibility. */
export type MailAliasWithOwned = MailAlias & { owned: boolean }
export type MailingListWithOwned = MailingList & { owned: boolean }

/**
 * A group in the flow, named after its type-specific relation so the flow needs no group lookup,
 * and with whether the session administrates it.
 */
export type MailFlowGroup = Group & { name: string, admin: boolean }

export type MailFlowObject = {
    alias: (MailAliasWithOwned & MailFlowPaths)[],
    mailingList: (MailingListWithOwned & MailFlowPaths)[],
    group: (MailFlowGroup & MailFlowPaths)[],
    user: (UserBasic & MailFlowPaths)[],
    mailaddressExternal: (MailAddressExternal & MailFlowPaths)[],
}
