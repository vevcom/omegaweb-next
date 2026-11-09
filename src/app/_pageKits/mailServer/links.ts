import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { MailListTypes } from '@/services/mail/types'
import type { MailServerPagesConfig } from './config'

/** The parts of the mail server with a page of their own, as the url names them. */
export const mailServerPartArray = ['mailingList', 'alias', 'mailaddressExternal'] as const
export type MailServerPart = typeof mailServerPartArray[number]

export type MailServerLinks = {
    frontpage: () => AppHref,
    /** The page of one part, listing only what the session owns when asked to. */
    part: (part: MailServerPart, onlyOwned?: boolean) => AppHref,
    /** The page of one node of the mail flow, which every type of node has, groups and users included. */
    node: (type: MailListTypes, id: number) => AppHref,
}

export const mailServerLinks = defineLinks<MailServerPagesConfig, MailServerLinks>(href => ({
    frontpage: () => href(),
    part: (part, onlyOwned = false) => href(`/${part}`, onlyOwned ? QueryParams.onlyOwned.encodeUrl(true) : null),
    node: (type, id) => href(`/${type}/${id}`),
}))
