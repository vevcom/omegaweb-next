import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { siteRedirect } from '@/app/domainContextOfRequest'
import { serverPage } from '@/app/ServerPage'

/** Where the chat's pages were before they got `/chat`, which links and notifications from then still lead to. */
const { page } = serverPage({
    operation: () => siteRedirect(chatLinks.settings()),
    render: () => null,
})

export default page
