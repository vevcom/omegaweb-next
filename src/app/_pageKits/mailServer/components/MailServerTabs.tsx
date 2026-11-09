import { mailServerLinks, mailServerPartArray } from '@/pageKits/mailServer/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailServerPart } from '@/pageKits/mailServer/links'

export const mailServerParts: Record<MailServerPart, { title: string, intro: string }> = {
    mailingList: {
        title: 'E-postlister',
        intro: 'Bindeleddet i e-posttjeneren. En e-postliste mottar e-post fra aliasene sine og'
            + ' videresender den til grupper, brukere og eksterne adresser.',
    },
    alias: {
        title: 'E-postalias',
        intro: 'Adressene det kan sendes e-post til. Et alias videresender alt det mottar til e-postlistene sine.',
    },
    mailaddressExternal: {
        title: 'Eksterne e-postadresser',
        intro: 'Mottakere utenfor nettsiden som kan settes på e-postlister.',
    },
}

/** The parts of the mail server as tabs, so every mail server page leads to the other parts. */
export default function MailServerTabs({
    config,
    active,
}: {
    config: MailServerPagesConfig,
    active: MailServerPart | null,
}) {
    const links = mailServerLinks(config)
    return <nav aria-label="Deler av e-posttjeneren" className="flex flex-wrap gap-1 border-b border-base-300">
        {mailServerPartArray.map(part => <SiteLink
            key={part}
            href={links.part(part)}
            aria-current={part === active ? 'page' : undefined}
            className="
                -mb-px px-4 py-2 no-underline text-base-content/80 border-b-2 border-transparent
                hover:text-base-content
                aria-[current=page]:text-base-content aria-[current=page]:border-primary aria-[current=page]:font-semibold
            "
        >
            {mailServerParts[part].title}
        </SiteLink>)}
    </nav>
}
