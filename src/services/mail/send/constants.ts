import '@pn-server-only'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import type SMTPPool from 'nodemailer/lib/smtp-pool'

/** Omega's sender for mail no one is meant to answer, on Omega's mail domain. */
export const defaultNotificationAlias = () => `noreply@${DomainContext.mailDomainOf(Site.root)}`

const port = Number(process.env.EMAIL_PORT) || 587
const secure = process.env.EMAIL_SECURE === 'true'
// For our own mail server (mail-infrastructure), reached by its in-cluster or compose name,
// which its certificate is not for. Still encrypted, just not verified.
const allowSelfSigned = process.env.EMAIL_TLS_ALLOW_SELF_SIGNED === 'true'

// Our own mail server takes the app's mail on a listener that asks for no login, see
// mail-infrastructure's README, so these are unset there. They are for a server that asks for one.
// The .env.default placeholder for unfilled-in secrets is treated the same as unset.
const UNSET_PLACEHOLDER = '<INSERT>'
const emailUser = process.env.EMAIL_USER
const emailPassword = process.env.EMAIL_PASSWORD
const hasAuth = Boolean(emailUser) && emailUser !== UNSET_PLACEHOLDER
    && Boolean(emailPassword) && emailPassword !== UNSET_PLACEHOLDER

// This configuration is only used in production. Otherwise ethereal is used.
export const TRANSPORT_OPTIONS: SMTPPool.Options = {
    pool: true,
    maxConnections: 20, // default is 5, I think sanctus is very fast to maybe this will work :))
    host: process.env.EMAIL_SERVER,
    port,
    secure,
    // Only STARTTLS on non-implicit-TLS ports - secure:true (465) already encrypts from connect.
    ...(secure ? {} : { requireTLS: true }),
    ...(allowSelfSigned ? { tls: { rejectUnauthorized: false } } : {}),
    ...(hasAuth ? {
        auth: {
            user: emailUser,
            pass: emailPassword,
        },
    } : {}),
}
