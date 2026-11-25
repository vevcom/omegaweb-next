import { UpdateCabinProductForm } from './UpdateCabinProductForm'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import { cabinProductOperations } from '@/services/cabin/product/operations'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { cabinAdminCardClassName, cabinAdminTableClassName } from '@/app/(omegaweb)/admin/cabinAdminStyles'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await authorizeAdminPage('cabin-product', session)
        return cabinProductOperations.readMany({})
    },
    capabilities: () => ({
        canCreate: cabinProductAuth.create,
    }),
    metadata: () => ({ title: 'Heutteprodukter' }),
    render: ({ data: products, capabilities }) => (
        <PageWrapper
            headerItem={capabilities.canCreate.authorized &&
                <AddHeaderItemPopUp popUpKey="UpdateCabinProductForm" label="Ny seng">
                    <UpdateCabinProductForm />
                </AddHeaderItemPopUp>
            }
        >
            <section className={`
                ${cabinAdminCardClassName}
                max-w-5xl
            `}>
                <p className="m-0 text-s text-base-content/80">
                    Det som kan bookes: hele hytta, og hver sengetype med hvor mange det finnes. Velg et produkt for å
                    se og legge til priser.
                </p>
                <div className="overflow-x-auto">
                    <SimpleTable
                        className={cabinAdminTableClassName}
                        header={['Produkt', 'Type', 'Antall på hytta']}
                        body={products.map(product => [
                            product.name,
                            product.type === 'CABIN' ? 'Hele hytta' : 'Seng',
                            product.amount,
                        ])}
                        links={products.map(product => appHref(`/admin/cabin-product/${product.id}`))}
                    />
                </div>
            </section>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
