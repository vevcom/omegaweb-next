import CreateMailAlias from '@/pageKits/mailServer/components/CreateMailAlias'
import CreateMailingList from '@/pageKits/mailServer/components/CreateMailingList'
import CreateMailAddressExternal from '@/pageKits/mailServer/components/CreateMailAddressExternal'
import MailServerTabs, { mailServerParts } from '@/pageKits/mailServer/components/MailServerTabs'
import { mailServerLinks, mailServerPartArray } from '@/pageKits/mailServer/links'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { aliasOperations } from '@/services/mail/alias/operations'
import { mailingListOperations } from '@/services/mail/list/operations'
import { mailAddressExternalOperations } from '@/services/mail/mailAddressExternal/operations'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import SiteLink from '@/components/SiteLink/SiteLink'
import { validMailAddressDomains } from '@/services/mail/constants'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { notFound } from 'next/navigation'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailServerPart } from '@/pageKits/mailServer/links'
import type { PageOperationArgs } from '@/app/ServerPage'

// Whether the create form is offered. Who the creator makes the owners is checked when they submit,
// so an empty matrix, which passes everyone, asks about the permissions alone.
const createAuth = {
    alias: () => mailAliasAuth.create.data({ ownerVisibility: { requirements: [] } }),
    mailingList: () => mailingListAuth.create.data({ ownerVisibility: { requirements: [] } }),
    mailaddressExternal: () => mailAddressExternalAuth.create,
} as const

/** One part of the mail server: its items, and a form creating one more for those who may. */
export const mailServerPartPage = (config: MailServerPagesConfig) => {
    const links = mailServerLinks(config)
    return serverPage({
        operation: async ({ params }: PageOperationArgs<{ filter: string }>) => {
            if (!mailServerPartArray.includes(params.filter as MailServerPart)) notFound()
            const part = params.filter as MailServerPart

            const items = await (async () => {
                if (part === 'alias') {
                    const aliases = await aliasOperations.readMany({})
                    return aliases.map(alias => ({ id: alias.id, label: alias.address, description: alias.description }))
                }
                if (part === 'mailingList') {
                    const lists = await mailingListOperations.readMany({})
                    return lists.map(list => ({ id: list.id, label: list.name, description: list.description }))
                }
                const externals = await mailAddressExternalOperations.readMany({})
                return externals.map(external => (
                    { id: external.id, label: external.address, description: external.description ?? '' }
                ))
            })()

            const domains = part === 'alias' ? validMailAddressDomains() : []
            const defaultDomain = part === 'alias' ? DomainContext.mailDomainOf(Site.of(config.defaultDomainOfSite)) : ''

            return { part, items, domains, defaultDomain }
        },
        capabilities: ({ part }) => ({
            canCreate: createAuth[part](),
        }),
        metadata: ({ part }) => ({ title: mailServerParts[part].title }),
        render: ({ data: { part, items, domains, defaultDomain }, capabilities }) => <PageWrapper>
            <div className="p-4 flex flex-col gap-4">
                <MailServerTabs config={config} active={part} />
                <p className="text-text-muted max-w-[60ch]">{mailServerParts[part].intro}</p>
                <div className="flex flex-row flex-wrap gap-6 items-start">
                    <ul className="flex-[1_1_300px] list-none p-0 m-0 flex flex-col gap-2 max-w-[40rem]">
                        {items.map(item => <li key={item.id}>
                            <SiteLink href={links.node(part, item.id)}
                                className="
                                    flex flex-col gap-1 p-4 rounded-round bg-surface-raised text-text no-underline
                                    transition-[background-color] duration-300
                                    hover:bg-surface-hover
                                    [&_span]:text-text-muted [&_span]:text-[0.9rem]
                                "
                            >
                                <strong>{item.label}</strong>
                                {item.description && <span>{item.description}</span>}
                            </SiteLink>
                        </li>)}
                        {items.length === 0 && <li className="text-text-muted italic">Ingen enda.</li>}
                    </ul>
                    {capabilities.canCreate.authorized && <aside
                        className="
                            flex-[0_1_20rem] bg-surface-raised rounded-[calc(3*var(--rounding))] p-(--card-padding)
                        "
                    >
                        {part === 'alias' && <CreateMailAlias
                            config={config}
                            domains={domains}
                            defaultDomain={defaultDomain}
                        />}
                        {part === 'mailingList' && <CreateMailingList config={config} />}
                        {part === 'mailaddressExternal' && <CreateMailAddressExternal config={config} />}
                    </aside>}
                </div>
            </div>
        </PageWrapper>,
    })
}
