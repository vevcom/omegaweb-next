import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { chatUserOperations } from '@/services/chat/users/operations'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import { chatClientOrigin } from '@/services/chat/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage } from '@/app/ServerPage'
import { appHref, externalHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'chat', session)
        const ofUser = { params: { userId: profile.user.id } }
        const [{ hasChatAccount, spaces }, administeredSpaces] = await Promise.all([
            chatUserOperations.readSpaces(ofUser),
            manualChatSpaceOperations.readAdministered(ofUser),
        ])
        return { hasChatAccount, spaces, administeredSpaces, chatClientOrigin }
    },
    render: ({ data: { hasChatAccount, spaces, administeredSpaces, chatClientOrigin: chat } }) => (
        <div className="flex flex-col gap-4">
            <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                <h2 className="m-0">Chat</h2>
                <p className="m-0">
                    {hasChatAccount
                        ? 'Du logger inn på chatten med samme innlogging som her.'
                        : 'Du får en konto på chatten første gang du logger inn der, med samme innlogging som her.'}
                </p>
                {chat && <SiteLink href={externalHref(chat)} target="_blank">Åpne chatten</SiteLink>}
            </div>

            <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                <h2 className="m-0">Chatområder</h2>
                {spaces.length === 0
                    ? <p className="m-0 text-base-content/80">Du er ikke med i noe chatområde.</p>
                    : <ul className="m-0 p-0 list-none flex flex-col gap-2">
                        {spaces.map(space => (
                            <li key={space.id} className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="font-medium">{space.name}</span>
                                {space.committee && (
                                    <SiteLink href={omegaLinks.committee(space.committee)} className="
                                        text-base-content/80
                                    ">
                                        Komiteen
                                    </SiteLink>
                                )}
                            </li>
                        ))}
                    </ul>
                }
            </div>

            {administeredSpaces.length > 0 && (
                <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                    <h2 className="m-0">Chatområder du styrer</h2>
                    <ul className="m-0 p-0 list-none flex flex-col gap-2">
                        {administeredSpaces.map(space => (
                            <li key={space.id}>
                                <SiteLink href={appHref(`/admin/chat-spaces/${space.id}`)}>{space.name}</SiteLink>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
