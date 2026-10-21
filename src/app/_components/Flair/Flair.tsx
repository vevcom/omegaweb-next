import Image from '@/components/Image/Image'
import type { FlairWithImage } from '@/services/flairs/types'

type PropTypes = {
    flair: FlairWithImage,
    width?: number,
}

export default function Flair({ flair, width = 50 }: PropTypes) {
    return (
        <div className="inline-flex items-center gap-[0.5em]">
            <Image image={flair.image} width={width} />
        </div>
    )
}
