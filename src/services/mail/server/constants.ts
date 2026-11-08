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

/** Whether the mail server's domains, mailing lists and sender account are kept in step with the database. */
export const mailServerIsManaged = Boolean(mailServerAdmin.url && mailServerAdmin.user && mailServerAdmin.password)

/**
 * The account the app sends mail as, which the sync keeps on the server with this password. The
 * same credentials sending uses, see src/lib/email/constants.ts.
 */
export const mailServerSender = {
    address: envValue('EMAIL_USER'),
    password: envValue('EMAIL_PASSWORD'),
}
