import CreateShopForm from './CreateShopForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { shopAuth } from '@/services/shop/shop/auth'
import { productAuth } from '@/services/shop/product/auth'
import { serverPage } from '@/app/ServerPage'
import { faArrowRight, faBox, faStore } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

const { page, generateMetadata } = serverPage({
    operation: () => shopOperations.readMany({}),
    capabilities: () => ({
        canCreateShop: shopAuth.create,
        // The product catalogue is for those who administer products across shops.
        canAdministerProducts: productAuth.readMany,
    }),
    metadata: () => ({ title: 'Butikker' }),
    render: ({ data: shops, capabilities }) => (
        <PageWrapper
            headerItem={
                <div className="flex items-center gap-[1em]">
                    {capabilities.canAdministerProducts.authorized && (
                        <HeaderItemLink href="/shop/products" label="Produkter" icon={faBox} />
                    )}
                    {capabilities.canCreateShop.authorized && (
                        <AddHeaderItemPopUp popUpKey="createShop">
                            <CreateShopForm />
                        </AddHeaderItemPopUp>
                    )}
                </div>
            }
        >
            {shops.length === 0 ? (
                <p className="text-text-muted">Det finnes ingen butikker ennå.</p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                    {sortObjectsByName(shops).map(shop => (
                        <Link
                            key={shop.id}
                            href={`/shop/${shop.id}`}
                            className="group flex flex-col gap-3 rounded-round bg-surface-raised p-5 text-text no-underline transition-colors duration-300 hover:bg-surface-hover hover:no-underline"
                        >
                            <span className="grid size-12 place-items-center rounded-full bg-accent-blue text-text-inv [&_svg]:text-inherit [&_path]:text-inherit">
                                <FontAwesomeIcon icon={faStore} className="size-5!" />
                            </span>
                            <h2 className="m-0 text-l">{shop.name}</h2>
                            {shop.description && <p className="m-0 text-s text-text-muted line-clamp-3">{shop.description}</p>}
                            <span className="mt-auto flex items-center gap-2 pt-2 text-s font-medium text-accent-blue [&_svg]:text-inherit [&_path]:text-inherit">
                                Gå til butikken
                                <FontAwesomeIcon icon={faArrowRight} className="size-3! transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
