import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage, withFallback } from '@/app/ServerPage'
import { appHref, externalHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import type { PageOperationArgs } from '@/app/ServerPage'

function ChatClientLink({ name, url }: { name: string, url: string | null }) {
    return url ? <SiteLink href={externalHref(url)} target="_blank">{name}</SiteLink> : name
}

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const ofUser = { params: { userId: authorizeChatPage(session).id } }
        const [spaces, administeredSpaces, chatSession] = await Promise.all([
            chatUserOperations.readSpaces(ofUser),
            manualChatSpaceOperations.readAdministered(ofUser),
            withFallback(chatSessionOperations.read(ofUser), null, ['NOT FOUND']),
        ])
        return { spaces, administeredSpaces, signsIn: chatSession !== null }
    },
    metadata: () => ({ title: 'Chatområder' }),
    render: ({ data: { spaces, administeredSpaces, signsIn } }) => (
        <div className="flex flex-col gap-4">
            <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                <h2 className="m-0">Chatområder</h2>
                {spaces.length === 0
                    ? <p className="m-0 text-base-content/80">Du er ikke med i noe chatområde.</p>
                    : <>
                        <p className="m-0 text-base-content/80">
                            Chatområdene du er med i og rommene deres.
                            {!signsIn && spaces.some(space => space.url || space.rooms.some(room => room.url))
                                && ' De med lenke åpnes i Element.'}
                        </p>
                        <ul className="m-0 p-0 list-none flex flex-col gap-4">
                            {spaces.map(space => (
                                <li key={space.id} className="flex flex-col gap-1">
                                    <div className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <span className="font-medium">
                                            <ChatClientLink name={space.name} url={signsIn ? null : space.url} />
                                        </span>
                                        {space.committee && (
                                            <SiteLink
                                                href={omegaLinks.committee(space.committee)}
                                                className="text-base-content/80"
                                            >
                                                Komiteen
                                            </SiteLink>
                                        )}
                                    </div>
                                    <ul className="m-0 pl-4 list-none flex flex-col gap-1">
                                        {space.rooms.map(room => (
                                            <li key={room.id}>
                                                {signsIn
                                                    ? <SiteLink href={chatLinks.spaceRoom(room)}>{room.name}</SiteLink>
                                                    : <ChatClientLink name={room.name} url={room.url} />}
                                                {room.isPrivate && <span className="text-base-content/80"> (privat)</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </>
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
