import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { productOperations } from '@/services/shop/product/operations'
import { describe, expect, test } from '@jest/globals'

const shopAdmin = Session.fromJsObject({ user: null, permissions: ['SHOP_ADMIN'], memberships: [] })

const createProduct = (name: string) => productOperations.create({
    data: { name, description: '' },
    session: shopAdmin,
})

describe('product photos', () => {
    test('a new product gets an empty cms image of its own', async () => {
        const product = await createProduct('Fotovare')

        const image = await prisma.cmsImage.findUniqueOrThrow({ where: { id: product.imageId } })
        expect(image.imageId).toBeNull()
    })

    test('the catalogue may change a product\'s photo', async () => {
        const product = await createProduct('Fotovare to')

        await expect(productOperations.updateCmsImage({
            implementationParams: { productId: product.id },
            params: { cmsImageId: product.imageId },
            data: { name: 'fotovare-to-bilde' },
            session: shopAdmin,
        })).resolves.toMatchObject({ name: 'fotovare-to-bilde' })
    })

    test('the photo of another product cannot be changed through this one', async () => {
        const product = await createProduct('Fotovare tre')
        const other = await createProduct('Fotovare fire')

        await expect(productOperations.updateCmsImage({
            implementationParams: { productId: product.id },
            params: { cmsImageId: other.imageId },
            data: { name: 'kapret' },
            session: shopAdmin,
        })).rejects.toThrow(new Smorekopp('DISSALLOWED'))
    })

    test('a session without access to the product may not change its photo', async () => {
        const product = await createProduct('Fotovare fem')

        await expect(productOperations.updateCmsImage({
            implementationParams: { productId: product.id },
            params: { cmsImageId: product.imageId },
            data: { name: 'uautorisert' },
            session: Session.empty(),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})
