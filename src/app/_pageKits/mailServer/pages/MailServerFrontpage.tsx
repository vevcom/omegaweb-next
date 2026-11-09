import { mailServerLinks } from '@/pageKits/mailServer/links'
import { siteRedirect } from '@/app/domainContextOfRequest'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'

/** The mount path itself: the mail server has a page per part, so this forwards to the most central of them. */
export const mailServerFrontpage = (config: MailServerPagesConfig) => async function MailServerFrontpage() {
    await siteRedirect(mailServerLinks(config).part('mailingList'))
}
