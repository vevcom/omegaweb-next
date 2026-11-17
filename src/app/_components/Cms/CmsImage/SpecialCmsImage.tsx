import CmsImage from './CmsImage'
import { readSpecialCmsPart } from '@/cms/readSpecialCmsPart'
import type { SpecialCmsImage as SpecialCmsImageT } from '@/prisma-generated-pn-types'
import type { PropTypes as CmsImageProps } from './CmsImage'
import type { ReadSpecialCmsImage } from '@/cms/images/types'

export type PropTypes = Omit<CmsImageProps, 'cmsImage'> & {
    special: SpecialCmsImageT,
    readSpecialCmsImage: ReadSpecialCmsImage
}

/**
 * Reads a special cms image and renders it with the standard CmsImage. A server component.
 * @param special - the special cms image to read
 * @param readSpecialCmsImage - the read operation of the service that owns the cms image
 */
export default async function SpecialCmsImage({ special, readSpecialCmsImage, ...props }: PropTypes) {
    const res = await readSpecialCmsPart(() => readSpecialCmsImage({ params: { special } }))
    if (!res.success) throw new Error(`No special cms image found for ${special}`)

    return (
        <CmsImage cmsImage={res.part} {...props} />
    )
}
