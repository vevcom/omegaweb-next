import { default as ImageComponent } from '@/components/Image/Image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    image: ExpandedImage,
    selected: boolean,
    onOpenDisplay?: () => void,
    onToggleSelect?: () => void,
}

/**
 * One image tile in an ImagePanel. Clicking the tile opens the large display when the panel has
 * one, otherwise it toggles selection. The checkmark button always toggles selection when
 * selection is active.
 */
export default function ImagePanelImage({ image, selected, onOpenDisplay, onToggleSelect }: PropTypes) {
    const handleTileClick = onOpenDisplay ?? onToggleSelect

    return (
        <div className={[
            'relative size-[200px] overflow-hidden rounded-round p-0 border-3 border-solid border-surface-subtle',
            'transition-[border-color] duration-300 hover:border-accent-blue',
            '[&>*:first-child]:absolute [&>*:first-child]:top-0 [&>*:first-child]:left-0',
            '[&>*:first-child]:w-full [&>*:first-child]:h-full',
            '[&>*:first-child>img]:absolute [&>*:first-child>img]:top-0 [&>*:first-child>img]:left-0',
            '[&>*:first-child>img]:w-full [&>*:first-child>img]:h-full [&>*:first-child>img]:object-cover',
            '[&>*:first-child>img]:transition-[scale] [&>*:first-child>img]:duration-500 [&>*:first-child>img]:ease-in-out',
            'hover:[&>*:first-child>img]:scale-110',
        ].join(' ')}>
            <ImageComponent hideCopyRight width={200} image={image} />
            {handleTileClick && <button
                className="z-1 absolute top-0 left-0 w-full h-full opacity-0 border-none bg-transparent hover:cursor-pointer"
                onClick={handleTileClick}
            />}
            {onToggleSelect && (
                <button
                    onClick={onToggleSelect}
                    className={[
                        'z-1 absolute top-0 right-0 size-[2em] m-[0.3em] rounded-full border-none text-ink-strong',
                        'transition-[background-color] duration-300 hover:cursor-pointer',
                        '[&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-1/2 [&>svg]:-translate-1/2 [&>svg]:w-[80%]!',
                        '[&>svg]:h-[80%]!',
                        selected ? 'bg-accent-blue' : 'bg-surface-subtle hover:bg-surface-hover',
                    ].join(' ')}
                >
                    <FontAwesomeIcon icon={faCheck} />
                </button>
            )}
        </div>
    )
}
