import ChatNav from './ChatNav'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatNavDef } from '@/app/(omegaweb)/chat/chatNavDef'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import ChatSessionProvider from '@/components/Chat/Session/ChatSessionProvider'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { serverLayout, withFallback } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: async ({ session }: LayoutOperationArgs) => {
        const user = authorizeChatPage(session)
        const [links, chatSession] = await Promise.all([
            chatNavDef({ userId: user.id }).visible(session),
            withFallback(chatSessionOperations.read({ params: { userId: user.id } }), null, ['NOT FOUND']),
        ])
        return { links, chatSession }
    },
    render: ({ data: { links, chatSession }, children }) => (
        <PageWrapper fillHeight transparent hideTitle>
            <div className="grid grid-rows-[1fr_auto] gap-2 h-full relative">
                <main className="relative h-full min-h-0">
                    <ScrollArea className="absolute! inset-0">
                        {chatSession
                            ? <ChatSessionProvider config={chatSession}>{children}</ChatSessionProvider>
                            : children}
                    </ScrollArea>
                </main>
                <ChatNav links={links} />
            </div>
        </PageWrapper>
    ),
})
