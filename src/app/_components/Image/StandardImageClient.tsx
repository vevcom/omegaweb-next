'use client'
import Image, { SrcImage } from './Image'
import { useStandardImages } from '@/contexts/ClientData'
import type { PropTypes } from './StandardImageServer'

const fallbackImage = '/images/fallback.jpg'

/**
 * WARNING: This component is only meant for the client - use StandardImage for the server
 * A component that displays a standard image, read from the ClientData cache (seeded by layout,
 * so no client fetch is needed). Falls back to a static placeholder if the standard image cannot
 * be resolved at all (should essentially never happen, as it self-heals from static config).
 * @param standardImage - the standard image to display
 * @returns
 */
export default function StandardImageClient({ standardImage, children, className = '', ...props }: PropTypes) {
    const result = useStandardImages()

    const renderImage = () => {
        if (result.status === 'loading') return null
        if (result.status === 'error') return <SrcImage src={fallbackImage} {...props} />
        return <Image image={result.standardImages[standardImage]} {...props} />
    }

    return (
        <div className={`
            [:where(&)]:relative [:where(&)]:isolate [:where(&)]:table
            ${className}
        `}>
            {renderImage()}
            {children && <div className="absolute top-0 left-0 w-full h-full flex">{children}</div>}
        </div>
    )
}
