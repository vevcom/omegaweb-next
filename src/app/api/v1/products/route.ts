import { apiHandler } from '@/api/apiHandler'
import { ServiceError } from '@/services/error'
import { productOperations } from '@/services/shop/product/operations'

export const GET = apiHandler({
    serviceOperation: productOperations.readByBarCode,
    query: searchParams => {
        const shopId = searchParams.get('shopId')
        if (!shopId?.trim()) {
            throw new ServiceError('BAD PARAMETERS', 'shopId is required.')
        }

        return {
            barcode: searchParams.get('barcode') ?? undefined,
            shopId: Number(shopId),
        }
    },
})
