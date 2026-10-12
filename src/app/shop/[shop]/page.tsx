import ShopUI from './ShopUI'
import { serverPage } from '@/app/serverPage'
import { shopOperations } from '@/services/shop/shop/operations'
import { authorizeShopAdminPage } from '@/app/admin/shop/[shop]/authorizeShopAdminPage'
import { Require } from '@/auth/authorizer/Require'
import type { PageOperationArgs } from '@/app/serverPage'


const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ shop: string }>) => {
        const shop = await shopOperations.read({
            params: {
                shopId: parseInt(params.shop, 10),
            }
        })

        const userId = Require.user().auth(session).requireAuthorized().session.user.id

        return { shop, userId }
    },
    capabilities: (data) => ({
        canAdminister: authorizeShopAdminPage(data.shop.visibility),
    }),
    metadata: (data) => ({ title: data.shop.name }),
    render: ({ data, capabilities }) => (
        <ShopUI
            userId={data.userId}
            shopData={data.shop}
            capabilities={{ canAdminister: capabilities.canAdminister.toJsObject() }}
        />
    )
})

export default page
export { generateMetadata }
