import '@pn-server-only'

import type SMTPPool from 'nodemailer/lib/smtp-pool'


export const DEFAULT_NOTIFICATION_ALIAS = `noreply@${process.env.EMAIL_DOMAIN}`

const port = Number(process.env.EMAIL_PORT) || 587
const secure = process.env.EMAIL_SECURE === 'true'
// For our own Postfix (mail-infrastructure), which has a self-signed certificate
// and is only reached over the internal Docker network. Still encrypted, just not verified.
const allowSelfSigned = process.env.EMAIL_TLS_ALLOW_SELF_SIGNED === 'true'

// The .env.default placeholder for unfilled-in secrets - treated the same as unset.
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
