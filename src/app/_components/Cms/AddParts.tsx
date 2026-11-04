import Button from '@/components/UI/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import type { ArticleSectionPart } from '@/cms/articleSections/types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * Component for adding parts to an article and article section.
 * Used by two wrapper components: AddSection and AddPartToArticleSection for atricle and article section respectively.
 */

export type PropTypes = {
    showParagraphAdd: boolean,
    showImageAdd: boolean,
    showLinkAdd: boolean
    onClick: (part: ArticleSectionPart) => Awaitable<void>
}

export default function AddParts({
    showImageAdd,
    showLinkAdd,
    showParagraphAdd,
    onClick
}: PropTypes) {
    const parts: {
        shouldShow: boolean,
        part: ArticleSectionPart,
        text: string
    }[] = [
        {
            shouldShow: showParagraphAdd,
            part: 'cmsParagraph',
            text: 'Avsnitt'
        },
        {
            shouldShow: showImageAdd,
            part: 'cmsImage',
            text: 'Bilde'
        },
        {
            shouldShow: showLinkAdd,
            part: 'cmsLink',
            text: 'Lenke'
        }
    ]

    return (
        <div className="
            z-1 flex
            [&_button]:flex [&_button]:items-center [&_button]:justify-center
            [&_button]:hover:cursor-pointer
        ">
            {
                parts.map((part, i) => part.shouldShow && (
                    <Button
                        key={i}
                        onClick={() => onClick(part.part)}
                        color="secondary"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        {part.text}
                    </Button>
                ))
            }
        </div>
    )
}
