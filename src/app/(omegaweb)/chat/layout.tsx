import ChatNav from './ChatNav'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatNavDef } from '@/app/(omegaweb)/chat/chatNavDef'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

export default serverLayout({
    operation: ({ session }: LayoutOperationArgs) =>
        chatNavDef({ userId: authorizeChatPage(session).id }).visible(session),
    render: ({ data: links, children }) => (
        <PageWrapper fillHeight transparent hideTitle>
            <div className="grid grid-rows-[1fr_auto] gap-2 h-full relative">
                <main className="relative h-full min-h-0">
                    <ScrollArea className="absolute! inset-0">
                        {children}
                    </ScrollArea>
                </main>
                <ChatNav links={links} />
            </div>
        </PageWrapper>
    ),
})
