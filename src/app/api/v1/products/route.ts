import { apiHandler } from '@/api/apiHandler'
import { ServiceError } from '@/services/error'
import { productOperations } from '@/services/shop/product/operations'

export const GET = apiHandler({
    serviceOperation: productOperations.readByBarCode,
    query: searchParams => {
        const shopId = searchParams.get('shopId')
        const barcode = searchParams.get('barcode')
        if (!shopId?.trim() || !barcode?.trim()) {
            throw new ServiceError('BAD PARAMETERS', 'shopId and barcode are required.')
        }

        return {
            barcode,
            shopId: Number(shopId),
        }
    },
})
