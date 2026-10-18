import { licenseOperations } from '@/services/licenses/operations'
import { mimeTypeForExtension } from '@/lib/store/fileExtensions'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { File } from 'node:buffer'
import type { StandardLicenseName } from '@/services/licenses/constants'
import type { imageSchemas } from '@/services/images/subservice/schemas'
import type { z } from 'zod'
import type { Awaitable } from '@/lib/awaitable'

const standardStoreRoot = join(process.cwd(), 'standard_store')

export type StandardStoreFile = {
    file: () => Awaitable<File>,
    credit: () => string | null,
    license: () => StandardLicenseName | null,
    originOfFile: () => URL | string
    imageUploadData: (imageData: { name: string, alt: string }) => Awaitable<z.input<typeof imageSchemas.data.uploadImage>>
}

const standardStoreFile = (config: {
    location: string,
    credit: string | null,
    license: StandardLicenseName | null,
    originOfFile: URL | string
}): StandardStoreFile => {
    const file = async () => {
        const filePath = join(standardStoreRoot, config.location)
        const fileContents = await readFile(filePath)
        const extension = config.location.split('.').pop() ?? ''
        const mimeType = mimeTypeForExtension(extension)
        if (!mimeType) {
            throw new Error(`Standard store file ${config.location} has an extension with no known mime type`)
        }
        return new File([fileContents], config.location, { type: mimeType })
    }

    return {
        file,
        credit: () => config.credit,
        license: () => config.license,
        originOfFile: () => config.originOfFile,
        imageUploadData: async (imageData) => {
            const license = config.license ? await licenseOperations.readStandardLicense.internalCall({
                params: { standardLicenseName: config.license }
            }) : null

            return {
                imageFile: await file(),
                imageName: imageData.name,
                imageAlt: imageData.alt,
                imageCredit: config.credit ?? undefined,
                imageLicenseId: license ? license.id : undefined,
            }
        }
    }
}

type StandardStoreFilesMap = {
    [key: string]: StandardStoreFile | Record<string, StandardStoreFile>
    devProfileImage: Record<string, StandardStoreFile>
}

export const standardStoreFiles = {
    defaultImage: standardStoreFile({
        location: 'default_image.png',
        credit: null,
        license: null,
        originOfFile: new URL('https://pixabay.com/vectors/image-media-icon-symbol-visual-2935360/'),
    }),
    album: standardStoreFile({
        location: 'album.jpeg',
        credit: null,
        license: null,
        originOfFile: new URL('https://pixabay.com/photos/photos-nostalgia-retro-photography-7666143/'),
    }),
    books: standardStoreFile({
        location: 'books.jpeg',
        credit: 'Alexander Grey',
        license: 'Paxels',
        originOfFile: new URL('https://www.pexels.com/photo/selective-focus-photo-of-pile-of-assorted-title-books-1148399/'),
    }),
    fair: standardStoreFile({
        location: 'fair.jpeg',
        credit: null,
        license: null,
        originOfFile: 'From contractor',
    }),
    harambe: standardStoreFile({
        location: 'harambe.jpg',
        credit: null,
        license: null,
        originOfFile: new URL('https://pixabay.com/photos/silverback-gorilla-male-gorilla-271002/'),
    }),
    hovedbygget: standardStoreFile({
        location: 'hovedbygget.jpeg',
        credit: 'Thomas Høstad/NTNU',
        license: 'CC BY-SA 4.0',
        originOfFile: new URL('https://ntnu.fotoware.cloud/fotoweb/archives/'),
    }),
    kongsberg: standardStoreFile({
        location: 'kongsberg.png',
        credit: null,
        license: null,
        originOfFile: 'Kongsberg Gruppen',
    }),
    logoSimple: standardStoreFile({
        location: 'logo_simple.svg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    logoWhite: standardStoreFile({
        location: 'logo_white.svg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    machine: standardStoreFile({
        location: 'machine.jpeg',
        credit: 'Børge Sandnes/NTNU',
        license: 'CC BY-SA 4.0',
        originOfFile: 'https://ntnu.fotoware.cloud/fotoweb/archives/',
    }),
    magiskHattWhite: standardStoreFile({
        location: 'magisk_hatt_white.png',
        credit: null,
        license: null,
        originOfFile: 'ow-basic',
    }),
    magiskHatt: standardStoreFile({
        location: 'magisk_hatt.svg',
        credit: null,
        license: null,
        originOfFile: 'ow-basic',
    }),
    omegaLogoWhite: standardStoreFile({
        location: 'omega_logo_white.svg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    omegaMai: standardStoreFile({
        location: 'Omegamai.jpeg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    ov: standardStoreFile({
        location: 'ov.jpeg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    pwa: standardStoreFile({
        location: 'pwa.svg',
        credit: null,
        license: null,
        originOfFile: 'pwa logo',
    }),
    realfagsbygget: standardStoreFile({
        location: 'realfagsbygget.jpeg',
        credit: 'Per Henning/NTNU',
        license: 'CC BY-SA 4.0',
        originOfFile: 'https://ntnu.fotoware.cloud/fotoweb/archives/',
    }),
    treaty: standardStoreFile({
        location: 'treaty.jpg',
        credit: null,
        license: null,
        originOfFile: new URL('https://pixabay.com/photos/paper-document-old-writing-vintage-3212015/'),
    }),
    vevcomLogo: standardStoreFile({
        location: 'vevcom_logo.svg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemann: standardStoreFile({
        location: 'kappemann.jpeg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemannBronse: standardStoreFile({
        location: 'kappemann_bronse.png',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemannDiamant: standardStoreFile({
        location: 'kappemann_diamant.png',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemannGull: standardStoreFile({
        location: 'kappemann_gull.png',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemannPaske: standardStoreFile({
        location: 'kappemann_paske.png',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    kappemannSolv: standardStoreFile({
        location: 'kappemann_solv.png',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    nordic: standardStoreFile({
        location: 'nordic.png',
        credit: null,
        license: null,
        originOfFile: 'nordic',
    }),
    ohma: standardStoreFile({
        location: 'ohma.jpeg',
        credit: null,
        license: null,
        originOfFile: 'ow - basic',
    }),
    devProfileImage: {
        Bjørn: standardStoreFile({
            location: 'dev_profile_images/Bjørn.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/bear-head-brown-brown-bear-1283347/'),
        }),
        Due: standardStoreFile({
            location: 'dev_profile_images/Due.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/dove-bird-freedom-flying-pigeon-2680487/'),
        }),
        Ekorn: standardStoreFile({
            location: 'dev_profile_images/Ekorn.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/squirrel-attentive-ears-cute-619968/'),
        }),
        Elefant: standardStoreFile({
            location: 'dev_profile_images/Elefant.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/elephant-nature-wildlife-safari-9772462/'),
        }),
        Frosk: standardStoreFile({
            location: 'dev_profile_images/Frosk.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/tree-frog-frog-amphibian-nature-8600329/'),
        }),
        Gås: standardStoreFile({
            location: 'dev_profile_images/Gås.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/goose-wild-goose-water-bird-bird-3477674/'),
        }),
        Hest: standardStoreFile({
            location: 'dev_profile_images/Hest.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/horse-wild-horse-sligo-ireland-8542469/'),
        }),
        Kanin: standardStoreFile({
            location: 'dev_profile_images/Kanin.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/eastern-cottontail-wild-rabbit-9604011/'),
        }),
        Løve: standardStoreFile({
            location: 'dev_profile_images/Løve.png',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/lion-feline-mane-barbary-lion-8096155/'),
        }),
        Papegøye: standardStoreFile({
            location: 'dev_profile_images/Papegøye.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/bird-parrot-ornithology-species-1823839/'),
        }),
        Påfugl: standardStoreFile({
            location: 'dev_profile_images/Påfugl.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/peacock-bird-multicoloured-poultry-2479685/'),
        }),
        Rev: standardStoreFile({
            location: 'dev_profile_images/Rev.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/fox-animal-wilderness-nature-2597803/'),
        }),
        Sjiraff: standardStoreFile({
            location: 'dev_profile_images/Sjiraff.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/flower-giraffe-giraffe-look-giraffe-6553711/'),
        }),
        Skilpadde: standardStoreFile({
            location: 'dev_profile_images/Skilpadde.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/turtle-tortoise-shell-terrestrial-4277518/'),
        }),
        Slange: standardStoreFile({
            location: 'dev_profile_images/Slange.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/green-tree-python-python-snake-9295182/'),
        }),
        Ugle: standardStoreFile({
            location: 'dev_profile_images/Ugle.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/boobook-owl-little-owl-staring-owl-1655548/'),
        }),
        Ørn: standardStoreFile({
            location: 'dev_profile_images/Ørn.jpg',
            credit: null,
            license: null,
            originOfFile: new URL('https://pixabay.com/photos/adler-eagle-bird-white-tailed-eagle-2386314/'),
        }),
    }
} as const satisfies StandardStoreFilesMap
