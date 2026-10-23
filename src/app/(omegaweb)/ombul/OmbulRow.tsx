import Image from '@/components/Image/Image'
import { formatVevenUri } from '@/lib/urlEncoding'
import Link from 'next/link'
import type { ExpandedOmbul } from '@/services/ombul/types'

type PropTypes = {
    ombul: ExpandedOmbul
}

/**
 * A compact list-row rendering of an ombul issue, for listings that lay their
 * items out as rows rather than as covers. The cover grid uses OmbulCover.
 * @param ombul - The ombul issue to display
 */
export default function OmbulRow({ ombul }: PropTypes) {
    return (
        <Link href={`/ombul/${ombul.year}/${formatVevenUri(ombul.name, ombul.id)}`} className="list-row">
            <div className="list-row-thumb">
                <Image
                    disableLinkingToLicense
                    creditPlacement="top"
                    width={200}
                    image={ombul.coverImage}
                />
            </div>

            <div className="list-row-lead">
                <b>{ombul.issueNumber}</b>
                <span>utgave</span>
            </div>

            <div className="list-row-main">
                <h2>{ombul.name}</h2>
                <p>{ombul.description}</p>
            </div>

            <div className="list-row-meta">
                <span>{ombul.year}</span>
            </div>
        </Link>
    )
}
