'use client'
import { sectionBackgrounds } from './sectionBackgrounds'
import { SectionHandleContext } from './sectionHandleContext'
import useEditMode from '@/hooks/useEditMode'
import useSiteRouter from '@/hooks/useSiteRouter'
import Button from '@/components/UI/Button'
import { imageSizeIncrement, maxImageSize, minImageSize } from '@/cms/articleSections/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faArrowRightArrowLeft,
    faImage,
    faLink,
    faMaximize,
    faMinimize,
    faParagraph,
    faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { useContext } from 'react'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { ArticleSection, SectionBackground } from '@/prisma-generated-pn-types'
import type {
    AddPartToArticleSectionAction,
    ArticleSectionPart,
    UpdateArticleSectionAction,
} from '@/cms/articleSections/types'
import type { ConfiguredAction } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

const swatchClassNames: Record<SectionBackground, string> = {
    NONE: 'bg-transparent border-dashed',
    BASE_100: 'bg-base-100',
    BASE_200: 'bg-base-200',
    BASE_300: 'bg-base-300',
}

const parts: { part: ArticleSectionPart, label: string, icon: IconDefinition }[] = [
    { part: 'cmsParagraph', label: 'Legg til avsnitt', icon: faParagraph },
    { part: 'cmsImage', label: 'Legg til bilde', icon: faImage },
    { part: 'cmsLink', label: 'Legg til lenke', icon: faLink },
]

const dividerClassName = 'w-px self-stretch bg-base-content/20'

type PropTypes = {
    articleSection: ArticleSection
    /** The parts the section holds, since one it has cannot be added again. */
    has: Record<ArticleSectionPart, boolean>
    updateArticleSectionAction: UpdateArticleSectionAction
    addPartToArticleSectionAction: ConfiguredAction<AddPartToArticleSectionAction>
    capabilities: CapabilitiesJsObject<'canEdit'>
}

/**
 * Everything that is set for a section as a whole, in one bar that shows in edit mode while the
 * section is pointed at or worked in: its place among the sections, its background, its image's
 * side and size, and the parts it can still be given.
 */
export default function SectionToolbar({
    articleSection,
    has,
    updateArticleSectionAction,
    addPartToArticleSectionAction,
    capabilities,
}: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const { refresh } = useSiteRouter()
    const handle = useContext(SectionHandleContext)

    if (!editable) return null

    const update = async (data: {
        background?: SectionBackground,
        imageSize?: number,
        position?: ArticleSection['imagePosition'],
    }) => {
        await updateArticleSectionAction({ params: { articleSectionName: articleSection.name } }, { data })
        refresh()
    }
    const addPart = async (part: ArticleSectionPart) => {
        await addPartToArticleSectionAction({ data: { part } })
        refresh()
    }
    const missingParts = parts.filter(({ part }) => !has[part])

    return (
        <div
            role="toolbar"
            aria-label="Seksjon"
            data-section-toolbar
            className="
                absolute -top-5 right-4 z-3 flex items-center gap-1 p-1 rounded-round bg-base-300 border
                border-base-content/20 shadow-md opacity-0 transition-opacity
                group-hover/section:opacity-100
                group-focus-within/section:opacity-100
                pointer-coarse:opacity-100
            "
        >
            {handle}
            {handle && <span className={dividerClassName} />}
            {(Object.keys(sectionBackgrounds) as SectionBackground[]).map(background => (
                <button
                    key={background}
                    type="button"
                    title={sectionBackgrounds[background].label}
                    aria-label={sectionBackgrounds[background].label}
                    aria-pressed={articleSection.background === background}
                    onClick={() => update({ background })}
                    className={`
                        size-5 shrink-0 mx-0.5 rounded-full border border-base-content/40 cursor-pointer
                        aria-pressed:ring-2 aria-pressed:ring-primary
                        ${swatchClassNames[background]}
                    `}
                />
            ))}
            {has.cmsImage && <>
                <span className={dividerClassName} />
                <Button
                    variant="icon"
                    color="neutral"
                    title="Flytt bildet til den andre siden"
                    aria-label="Flytt bildet til den andre siden"
                    onClick={() => update({ position: articleSection.imagePosition === 'LEFT' ? 'RIGHT' : 'LEFT' })}
                >
                    <FontAwesomeIcon icon={faArrowRightArrowLeft} />
                </Button>
                <Button
                    variant="icon"
                    color="neutral"
                    title="Mindre bilde"
                    aria-label="Mindre bilde"
                    disabled={articleSection.imageSize - imageSizeIncrement < minImageSize}
                    onClick={() => update({ imageSize: articleSection.imageSize - imageSizeIncrement })}
                >
                    <FontAwesomeIcon icon={faMinimize} />
                </Button>
                <Button
                    variant="icon"
                    color="neutral"
                    title="Større bilde"
                    aria-label="Større bilde"
                    disabled={articleSection.imageSize + imageSizeIncrement > maxImageSize}
                    onClick={() => update({ imageSize: articleSection.imageSize + imageSizeIncrement })}
                >
                    <FontAwesomeIcon icon={faMaximize} />
                </Button>
            </>}
            {missingParts.length > 0 && <span className={dividerClassName} />}
            {missingParts.map(({ part, label, icon }) => (
                <Button
                    key={part}
                    variant="icon"
                    color="neutral"
                    title={label}
                    aria-label={label}
                    className="w-auto! px-2 grid-flow-col gap-1"
                    onClick={() => addPart(part)}
                >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    <FontAwesomeIcon icon={icon} />
                </Button>
            ))}
        </div>
    )
}
