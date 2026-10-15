'use client'
import useEditMode from '@/hooks/useEditMode'
import { imageSizeIncrement, maxImageSize, minImageSize } from '@/cms/articleSections/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faChevronLeft,
    faChevronRight,
    faMaximize,
    faMinimize
} from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import type { ArticleSection } from '@/prisma-generated-pn-types'
import type { UpdateArticleSectionAction } from '@/cms/articleSections/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    articleSection: ArticleSection
    className?: string
    updateArticleSectionAction: UpdateArticleSectionAction
    capabilities: CapabilitiesJsObject<'canEdit'>
}

/**
 * This component is used to control the image in the article section
 * i.e move it left or right and size it
 */
const moveButtonClassName = [
    'absolute -translate-y-1/2 w-[30%] h-full -top-1/2 bg-surface-raised flex justify-center items-center border-none',
    '[&_svg]:text-white [&_svg]:w-[40%] [&_svg]:h-[40%] [&_path]:[translate:10px_0]',
    'hover:bg-surface-hover hover:cursor-pointer hover:[&_svg]:text-accent-blue',
].join(' ')

const sizeButtonClassName = [
    'bg-transparent border-none w-[25px] h-[25px] first:mr-4',
    '[&_svg]:w-full [&_svg]:h-full [&_svg]:text-white',
].join(' ')

const sizeButtonStateClassName = (disabled: boolean) => (
    disabled ? 'opacity-50' : 'hover:cursor-pointer hover:[&_svg]:text-accent-blue'
)

export default function ImageControls({ articleSection, className, updateArticleSectionAction, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const { refresh } = useRouter()

    const moveLeft = async () => {
        await updateArticleSectionAction(
            { params: { articleSectionName: articleSection.name } },
            { data: { position: 'LEFT' } }
        )
        refresh()
    }

    const moveRight = async () => {
        await updateArticleSectionAction(
            { params: { articleSectionName: articleSection.name } },
            { data: { position: 'RIGHT' } }
        )
        refresh()
    }

    const increaseSize = async () => {
        await updateArticleSectionAction(
            { params: { articleSectionName: articleSection.name } },
            { data: { imageSize: articleSection.imageSize + imageSizeIncrement } }
        )
        refresh()
    }

    const decreaseSize = async () => {
        await updateArticleSectionAction(
            { params: { articleSectionName: articleSection.name } },
            { data: { imageSize: articleSection.imageSize - imageSizeIncrement } }
        )
        refresh()
    }

    if (!editable) return null
    return (
        <div className={className}>
            {
                articleSection.imagePosition === 'LEFT' ? (
                    <button onClick={moveRight} className={`${moveButtonClassName} rounded-r-round right-0`}>
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                ) : (
                    <button onClick={moveLeft} className={`${moveButtonClassName} rounded-l-round left-0`}>
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                )
            }
            <div
                className={
                    articleSection.imagePosition === 'LEFT' ?
                        'absolute -top-full bg-surface-raised p-[.5em] left-0 rounded-tl-round' :
                        // Extra top/right padding keeps clear of the remove-image button.
                        'absolute -top-full bg-surface-raised p-[.5em] right-0 rounded-tr-round pt-[1.2em] pr-[1.2em]'
                }
            >
                <button onClick={increaseSize} className={`${sizeButtonClassName} ${sizeButtonStateClassName(
                    articleSection.imageSize + imageSizeIncrement > maxImageSize
                )}`}>
                    <FontAwesomeIcon icon={faMaximize} />
                </button>
                <button onClick={decreaseSize} className={`${sizeButtonClassName} ${sizeButtonStateClassName(
                    articleSection.imageSize - imageSizeIncrement < minImageSize
                )}`}>
                    <FontAwesomeIcon icon={faMinimize} />
                </button>
            </div>
        </div>
    )
}
