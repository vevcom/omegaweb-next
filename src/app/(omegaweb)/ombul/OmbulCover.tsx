import styles from './OmbulCover.module.scss'
import Image from '@/components/Image/Image'
import Link from 'next/link'
import type { ExpandedOmbul } from '@/services/ombul/types'

export type PropTypesPreview = {
    pImage: File,
    pName: string,
    pYear: string,
    pIssueNumber: string,
    pDescription: string
}

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
            <div className={styles.noCoverImage}>Cover ikke valgt</div>
        )
    )

    const content = <>
        <div className={styles.coverImg}>
            {
                coverImage instanceof File ? (
                    placeholderCover
                ) : (
                    <Image width={250} image={coverImage} className={styles.coverImg} />
                )
            }
        </div>
        <h2>{name}</h2>
        <h5>{year} - {issueNumber}</h5>
        <p>{description}</p>
    </>

    return props.ombul ? (
        <Link className={styles.OmbulCover} href={`/ombul/${props.ombul.year}/${props.ombul.name}`}>
            { content }
        </Link>
    ) : (
        <div className={styles.OmbulCover}>
            { content }
        </div>
    )
}
