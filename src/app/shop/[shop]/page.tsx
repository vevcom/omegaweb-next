import { notFound } from 'next/navigation'
import ShopUI from './shopComponent'
import { serverPage } from '@/app/serverPage'
import { shopOperations } from '@/services/shop/shop/operations'
import { Require } from '@/auth/authorizer/Require'
import type { PageOperationArgs } from '@/app/serverPage'


const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ shop: string }>) => {
        const shop = await shopOperations.read({
            params: {
                shopId: parseInt(params.shop, 10),
            }
        })
        if (!shop) {
            return notFound()
        }

        const userId = Require.user().auth(session).requireAuthorized().session.user.id

        return { shop, userId }
    },
    metadata: () => ({ title: '' }),
    render: ({ data }) =>
        <ShopUI userId={data.userId} shopData={data.shop}></ShopUI>
})

export default page
export { generateMetadata }
