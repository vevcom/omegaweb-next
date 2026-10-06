import ShopUI from './shopComponent'
import { unwrapActionReturn } from '@/app/redirectToErrorPage'
import { ServerSession } from '@/auth/session/ServerSession'
import { readShopAction } from '@/services/shop/actions'
import { notFound } from 'next/navigation'

type PropTypes = {
    params: Promise<{
        shop: string
    }>
}

export default async function Shop({ params }: PropTypes) {
    const shopId = parseInt((await params).shop, 10)
    if (isNaN(shopId)) notFound()

    const shopData = unwrapActionReturn(await readShopAction({
        params: {
            shopId,
        },
    }))

    if (!shopData) notFound()

    const session = await ServerSession.fromNextAuth()
    if (!session) notFound()

    const userId = session.user.id
    // const [shoppingCart, editShoppingCart] = useState()
    return <ShopUI userId={userId} shopData={shopData}></ShopUI>
}
