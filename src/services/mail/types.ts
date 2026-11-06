
import type { MailListTypeArray } from './constants'
import type { Group, MailAddressExternal, MailAlias, MailingList } from '@/prisma-generated-pn-types'
import type { UserBasic } from '@/services/users/types'

export type MailListTypes = typeof MailListTypeArray[number];

export type ViaType = {
    type: MailListTypes,
    id: number,
    label: string,
}

export type ViaArrayType = {
    via?: ViaType[],
}

/** A group in the flow, named after its type-specific relation so the flow needs no group lookup. */
export type MailFlowGroup = Group & { name: string }

// The via property sits on each item: the traversal annotates every node it reaches
// indirectly (e.g. a user on a list through a group) with how it got there.
export type MailFlowObject = {
    alias: (MailAlias & ViaArrayType)[],
    mailingList: (MailingList & ViaArrayType)[],
    group: (MailFlowGroup & ViaArrayType)[],
    user: (UserBasic & ViaArrayType)[],
    mailaddressExternal: (MailAddressExternal & ViaArrayType)[],
}
