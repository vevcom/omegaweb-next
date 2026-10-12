import { UpdateCabinProductForm } from './UpdateCabinProductForm'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/serverPage'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('cabin-product', session)
        return cabinProductOperations.readMany({})
    },
    metadata: () => ({ title: 'Heutte produkter' }),
    render: ({ data: products }) => (
        <PageWrapper
            headerItem={<AddHeaderItemPopUp popUpKey="UpdateCabinProductForm">
                <UpdateCabinProductForm />
            </AddHeaderItemPopUp>}
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
