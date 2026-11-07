import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'

/** The mail server admin in the career site's admin panel. */
export const careerMailServerPages: MailServerPagesConfig = {
    site: 'CAREERS',
    mountPath: '/admin/mail',
    defaultDomainOfSite: 'CAREERS',
}
