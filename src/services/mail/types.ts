
import type { Group, MailAddressExternal, MailAlias, MailingList } from '@/prisma-generated-pn-types'
import type { UserBasic } from '@/services/users/types'


export const MailListTypeArray = ['alias', 'mailingList', 'group', 'user', 'mailaddressExternal'] as const
export type MailListTypes = typeof MailListTypeArray[number];

export type ViaType = {
    type: MailListTypes,
    id: number,
    label: string,
}

export type ViaArrayType = {
    via?: ViaType[],
}

// The via property sits on each item: the traversal annotates every node it reaches
// indirectly (e.g. a user on a list through a group) with how it got there.
export type MailFlowObject = {
    alias: (MailAlias & ViaArrayType)[],
    mailingList: (MailingList & ViaArrayType)[],
    group: (Group & ViaArrayType)[],
    user: (UserBasic & ViaArrayType)[],
    mailaddressExternal: (MailAddressExternal & ViaArrayType)[],
}
