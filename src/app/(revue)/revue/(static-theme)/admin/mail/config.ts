import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'

/** The mail server admin in the revue site's admin panel. */
export const revueMailServerPages: MailServerPagesConfig = {
    site: 'REVUE',
    mountPath: '/admin/mail',
    defaultDomainOfSite: 'REVUE',
}
