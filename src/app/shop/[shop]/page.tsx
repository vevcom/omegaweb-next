import ShopUI from './ShopUI'
import { authorizeShopAdminPage } from '@/app/admin/shop/[shop]/authorizeShopAdminPage'
import { serverPage } from '@/app/serverPage'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { Require } from '@/auth/authorizer/Require'
import { purchaseAuth } from '@/services/shop/purchase/auth'
import { shopOperations } from '@/services/shop/shop/operations'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ shop: string }>) => ({
        shop: await shopOperations.read({ params: { shopId: parseInt(params.shop, 10) } }),
        userId: session.user?.id ?? null,
    }),
    capabilities: (data, session) => ({
        canAdminister: authorizeShopAdminPage(data.shop.visibility),
        canPurchase: session.user
            ? purchaseAuth.create.data({ userId: session.user.id, visibility: data.shop.visibility })
            : Require.user(),
    }),
    metadata: (data) => ({ title: data.shop.name }),
    render: ({ data, capabilities }) => (
        <ShopUI shop={data.shop} userId={data.userId} capabilities={capabilitiesToJsObject(capabilities)} />
    ),
})

export default page
export { generateMetadata }
