import Image from '@/components/Image/Image'
import { formatVevenUri } from '@/lib/urlEncoding'
import Link from 'next/link'
import type { ExpandedOmbul } from '@/services/ombul/types'

export type PropTypesPreview = {
    pImage: File,
    pName: string,
    pYear: string,
    pIssueNumber: string,
    pDescription: string
}

const coverImgClassName = 'w-full mb-2 [&>*]:rounded-round [&>*]:overflow-hidden [&>*]:w-full [&>*]:h-full [&>*>*]:rounded-round [&>*>*]:overflow-hidden [&>*>*]:w-full [&>*>*]:h-full [&_img]:transition-[scale] [&_img]:duration-300 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:min-h-[50px]'

const ombulCoverClassName = "flex flex-col items-center relative text-text no-underline [&>*]:text-center [&>*]:w-full [&>p]:font-light [&>h2]:after:content-[''] [&>h2]:after:block [&>h2]:after:w-full [&>h2]:after:h-[2px] [&>h2]:after:bg-surface-subtle [&>h2]:after:mb-2 max-mobile:[&>h2]:text-xl"

type PropTypes = {
    ombul: ExpandedOmbul
} | {
    ombul: null
    preview: PropTypesPreview
}

/**
 *
 * @param ombul - The ombul issue to display
 * @param preview - If ombul is null, the preview object is used to display the ombul issue based on params in preview
 * @returns
 */
export default function OmbulCover(props: PropTypes) {
    const name = props.ombul ? props.ombul.name : props.preview.pName
    const year = props.ombul ? props.ombul.year : props.preview.pYear
    const issueNumber = props.ombul ? props.ombul.issueNumber : props.preview.pIssueNumber
    const description = props.ombul ? props.ombul.description : props.preview.pDescription
    const coverImage = props.ombul ? props.ombul.coverImage : props.preview.pImage

    const placeholderCover = (
        coverImage instanceof File && coverImage.size ? (
            <img src={URL.createObjectURL(coverImage)} />
        ) : (
            <div className="border-[3px] border-surface-subtle aspect-[5/7] grid place-items-center">Cover ikke valgt</div>
        )
    )

    const content = <>
        <div className={coverImgClassName}>
            {
                coverImage instanceof File ? (
                    placeholderCover
                ) : (
                    <Image width={250} image={coverImage} className={coverImgClassName} />
                )
            }
        </div>
        <h2>{name}</h2>
        <h5>{year} - {issueNumber}</h5>
        <p>{description}</p>
    </>

    return props.ombul ? (
        <Link
            className={`${ombulCoverClassName} hover:[&_img]:scale-110`}
            href={`/ombul/${props.ombul.year}/${formatVevenUri(props.ombul.name, props.ombul.id)}`}
        >
            { content }
        </Link>
    ) : (
        <div className={ombulCoverClassName}>
            { content }
        </div>
    )
}
