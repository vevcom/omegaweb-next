import getCommittee from './getCommittee'
import Nav from './Nav'
import { committeeNavDef } from './committeeNavDef'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import CommitteeImage from '@/components/Committee/CommitteeImage/CommitteeImage'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverLayout } from '@/app/ServerPage'
import { Require } from '@/auth/authorizer/Require'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: async ({ params, session }: LayoutOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const navDef = committeeNavDef({ shortName: params.shortName, groupId: committee.groupId })
        return { committee, navLinks: await navDef.visible(session) }
    },
    capabilities: ({ committee }) => ({
        // A pensioned committee is history: the service refuses every change to it, so the
        // editing controls are not offered on any of its pages either.
        canEditCoverImage: Require.allOf(
            committeeAuth.updateArticle.data({ groupId: committee.groupId }),
            Require.custom(() => !committee.group.pensioned, { errorMessage: 'Komitéen er pensjonert' }),
        ),
    }),
    render: ({ data: { committee, navLinks }, capabilities, children }) => (
        <div className="grid grid-rows-[1fr_auto] h-full min-h-0">
            <ScrollArea className="min-h-0 rounded-round mb-2 overflow-hidden">
                <CommitteeImage
                    capabilities={capabilities}
                    shortName={committee.shortName}
                    logoImage={committee.logoImage}
                    coverImage={committee.coverImage}
                />
                <PageWrapper className="rounded-round h-auto! overflow-visible!">
                    <PageTitleSetter title={committee.name} />
                    {committee.group.pensioned && (
                        <p className="py-2 px-4 mb-4 rounded-round border border-base-content/80 text-base-content/80">
                            Denne komitéen er pensjonert. Den har ingen aktive medlemmer, og
                            innholdet står som det var.
                        </p>
                    )}
                    { children }
                </PageWrapper>
            </ScrollArea>
            <Nav links={navLinks} />
        </div>
    ),
})
