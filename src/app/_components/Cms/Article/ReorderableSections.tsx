'use client'
import useEditMode from '@/hooks/useEditMode'
import useSiteRouter from '@/hooks/useSiteRouter'
import ReorderableList from '@/components/UI/ReorderableList'
import { SectionHandleContext } from '@/cms/ArticleSection/sectionHandleContext'
import { maxSections } from '@/cms/articles/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'
import type { ConfiguredAction } from '@/services/actionTypes'
import type { AddSectionToArticleAction, ReorderArticleSectionsAction } from '@/cms/articles/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    /** The sections in the order they are shown, each already rendered. */
    sections: { id: number, node: ReactNode }[]
    reorderArticleSectionsAction: ConfiguredAction<ReorderArticleSectionsAction>
    addSectionToArticleAction: ConfiguredAction<AddSectionToArticleAction>
    capabilities: CapabilitiesJsObject<'canEdit'>
}

/**
 * The sections of an article. In edit mode they are dragged into a new order by their handles, and
 * between them, before the first and after the last is a place to put a new one in.
 */
export default function ReorderableSections({
    sections,
    reorderArticleSectionsAction,
    addSectionToArticleAction,
    capabilities,
}: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const { refresh } = useSiteRouter()

    if (!editable) {
        return sections.map(section => (
            <span key={section.id} className="relative block">{section.node}</span>
        ))
    }

    const full = sections.length >= maxSections
    /** A new section starts as a paragraph. Its toolbar gives it an image or a link. */
    const inserter = (afterSectionId: number | null) => !full && (
        <div className="group/inserter relative h-6 flex items-center justify-center">
            <span className="
                absolute inset-x-0 h-px bg-primary opacity-0 transition-opacity
                group-hover/inserter:opacity-100
                group-focus-within/inserter:opacity-100
            " />
            <button
                type="button"
                title="Ny seksjon her"
                aria-label="Ny seksjon her"
                onClick={async () => {
                    await addSectionToArticleAction({
                        data: { includeParts: { cmsParagraph: true }, afterSectionId },
                    })
                    refresh()
                }}
                className="
                    relative size-6 rounded-full border-none bg-primary text-primary-content grid place-items-center
                    cursor-pointer opacity-40 transition-opacity
                    hover:opacity-100
                    focus-visible:opacity-100
                    group-hover/inserter:opacity-100
                "
            >
                <FontAwesomeIcon icon={faPlus} className="text-xs" />
            </button>
        </div>
    )

    return <>
        {inserter(null)}
        <ReorderableList
            items={sections}
            getId={section => section.id}
            saveOrder={sectionIds => reorderArticleSectionsAction({ data: { sectionIds } })}
            renderItem={(section, { handle }) => <>
                <SectionHandleContext.Provider value={handle}>{section.node}</SectionHandleContext.Provider>
                {inserter(section.id)}
            </>}
        />
        {full && <p className="text-center text-s text-base-content/80">Maks {maxSections} seksjoner er nådd.</p>}
    </>
}
