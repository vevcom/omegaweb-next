import { siteRedirect } from '@/app/siteContextOfRequest'

// The mail admin is split into one page per part (see the admin nav) - the old combined page
// only forwards to the most central of them.
export default async function MailSettings() {
    await siteRedirect('/admin/mail/mailingList')
}
