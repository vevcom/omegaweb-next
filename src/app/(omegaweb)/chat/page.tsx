import ChatAccountNotice from './ChatAccountNotice'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatUserOperations } from '@/services/chat/users/operations'
import { chatClientOrigin } from '@/services/chat/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage, withFallback } from '@/app/ServerPage'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const user = authorizeChatPage(session)
        const chatUser = await withFallback(chatUserOperations.read({ params: { userId: user.id } }), null, ['NOT FOUND'])
        return { hasChatAccount: chatUser !== null }
    },
    metadata: () => ({ title: 'Meldinger' }),
    render: ({ data: { hasChatAccount } }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Meldinger</h2>
            <p className="m-0">
                Direktemeldinger og grupper ligger bare på chatten, så de vises ikke her ennå.
                {chatClientOrigin && ' Du leser og skriver dem i Element.'}
            </p>
            <ChatAccountNotice hasChatAccount={hasChatAccount} />
            {chatClientOrigin && (
                <SiteLink href={externalHref(chatClientOrigin)} target="_blank">Åpne chatten</SiteLink>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
