import { UpdateCabinProductForm } from './UpdateCabinProductForm'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('cabin-product', session)
        return cabinProductOperations.readMany({})
    },
    capabilities: () => ({
        canCreate: cabinProductAuth.create,
    }),
    metadata: () => ({ title: 'Heutte produkter' }),
    render: ({ data: products, capabilities }) => (
        <PageWrapper
            headerItem={capabilities.canCreate.authorized &&
                <AddHeaderItemPopUp popUpKey="UpdateCabinProductForm">
                    <UpdateCabinProductForm />
                </AddHeaderItemPopUp>
            }
        >
            <SimpleTable
                header={[
                    'Produkt',
                    'Type',
                    'Antall'
                ]}
                body={products.map(product => [
                    product.name,
                    product.type,
                    product.amount.toString()
                ])}
                links={products.map(product => `/admin/cabin-product/${product.id}`)}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
