import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'

/** The mail server admin in Omega's admin panel. */
export const omegaMailServerPages: MailServerPagesConfig = {
    site: 'OMEGAWEB',
    mountPath: '/admin/mail',
    defaultDomainOfSite: 'OMEGAWEB',
}
