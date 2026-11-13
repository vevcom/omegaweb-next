import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import { manualChatSpaceAuth } from '@/services/manualChat/auth'
import { createManualChatSpaceAction } from '@/services/manualChat/actions'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await authorizeAdminPage('chat-spaces', session)
        return manualChatSpaceOperations.readAll({})
    },
    capabilities: () => ({ canCreate: manualChatSpaceAuth.create }),
    metadata: () => ({ title: 'Chatområder' }),
    render: ({ data: spaces, capabilities }) => (
        <PageWrapper
            headerItem={capabilities.canCreate.authorized && (
                <AddHeaderItemPopUp popUpKey="create manual chat space">
                    <Form title="Opprett chatområde" action={createManualChatSpaceAction} refreshOnSuccess>
                        <TextInput name="name" label="Navn" />
                    </Form>
                </AddHeaderItemPopUp>
            )}
        >
            <p className="text-base-content/80 max-w-[70ch]">
                Chatområder som ikke er en komités. Hvert område styres av dem som velges til det, som bestemmer
                rommene og medlemmene. Komiteenes chatområder styres fra komiteens egen side.
            </p>
            <table className="ohma-table">
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>Styres av</th>
                        <th>Medlemmer</th>
                    </tr>
                </thead>
                <tbody>
                    {spaces.map(space => (
                        <tr key={space.id}>
                            <th>
                                <SiteLink href={appHref(`/admin/chat-spaces/${space.id}`)}>{space.name}</SiteLink>
                            </th>
                            <td>
                                {space.admins.length === 0 && 'Ingen ennå'}
                                {space.admins.map(admin => `${admin.firstname} ${admin.lastname}`).join(', ')}
                            </td>
                            <td>{space.memberCount}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
