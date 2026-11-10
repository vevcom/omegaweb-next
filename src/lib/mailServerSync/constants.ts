import '@pn-server-only'

// The .env.default placeholder for unfilled-in secrets, treated the same as unset.
const UNSET_PLACEHOLDER = '<INSERT>'

function envValue(name: string): string | undefined {
    const value = process.env[name]
    if (!value || value === UNSET_PLACEHOLDER) return undefined
    return value
}

/**
 * The management API of the mail server, Stalwart, and the admin it is called as. The server cannot
 * read the aliases from the database the way Postfix did, so the mail worker pushes them there as
 * mailing lists, see sync.ts. Left unset, nothing is synced.
 */
export const mailServerAdmin = {
    url: envValue('EMAIL_ADMIN_URL'),
    user: envValue('EMAIL_ADMIN_USER'),
    password: envValue('EMAIL_ADMIN_PASSWORD'),
}

/** Whether the mail server's domains and mailing lists are kept in step with the database. */
export const mailServerIsManaged = Boolean(mailServerAdmin.url && mailServerAdmin.user && mailServerAdmin.password)

/**
 * The webmail of that server, where everyone who receives an alias's mail reads its mailbox, unless
 * the owners have switched the mailbox off. Its host is also the mail domain the mailboxes are on,
 * so one value names both, see mailboxes.ts. Left unset, no alias keeps a mailbox.
 */
export const mailServerWebmail = webmailOf(envValue('EMAIL_WEBMAIL_URL'))

/** The webmail's origin, which links to it point at, and its host, the mail domain of the mailboxes. */
export type MailServerWebmail = { origin: string, domain: string }

function webmailOf(url: string | undefined): MailServerWebmail | null {
    if (!url) return null
    const parsed = URL.parse(url)
    if (!parsed) throw new Error(`EMAIL_WEBMAIL_URL is not a url: ${url}`)
    return { origin: parsed.origin, domain: parsed.hostname.toLowerCase() }
}

/** Whether aliases keep mailboxes: a managed server, and a webmail to read them in. */
export const mailboxesAreAvailable = mailServerIsManaged && mailServerWebmail !== null
