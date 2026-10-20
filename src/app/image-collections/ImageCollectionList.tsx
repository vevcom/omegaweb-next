'use client'
import CollectionCardLink from '@/components/Image/Collection/CollectionCardLink'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import ModeSwitch from '@/UI/ModeSwitch'
import { DynamicImageCollectionPagingContext } from '@/contexts/paging/DynamicImageCollectionPaging'
import { useSpecialCollections } from '@/contexts/ClientData'
import { useState, type ReactNode } from 'react'

const gridClassName = 'w-full flex flex-wrap justify-start gap-2 [&>*:not(.loading-control)]:size-[250px] [&>*:not(.loading-control)]:overflow-hidden [&>*:not(.loading-control)]:rounded-round [&>*:not(.loading-control)]:relative max-[540px]:[&>*:not(.loading-control)]:size-[min(90vw,350px)]'

type PropTypes = {
    serverRendered: ReactNode,
    toggle?: ReactNode,
}

/**
 * WARNING: The server rendered data should be CollectioCards to make it consistent with the endless scroll
 * @param serverRendered - Make sure to pass the server rendered collections here in the correct format
 * @returns
 */
export default function ImageCollectionList({ serverRendered, toggle }: PropTypes) {
    const [mode, setMode] = useState<'special' | 'dynamic'>('dynamic')

    const specialCollectionsResult = useSpecialCollections()

    const renderSpecialCollections = () => {
        if (specialCollectionsResult.status === 'loading') return <i>Laster inn...</i>
        if (specialCollectionsResult.status === 'error') return <p>Noe gikk galt</p>
        return specialCollectionsResult.specialCollections.map(collection => (
            <CollectionCardLink key={collection.id} collection={collection} />
        ))
    }

    return (
        <div className="w-full">
            <div className="w-full flex flex-wrap items-center gap-2 mb-2">
                <ModeSwitch
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'dynamic', label: 'Bildealbum' },
                        { value: 'special', label: 'Spesialsamlinger' },
                    ]}
                />
                {toggle && <div className="ml-auto max-mobile:ml-0">{toggle}</div>}
            </div>
            {mode === 'dynamic' ? (
                <div className={gridClassName}>
                    {serverRendered} {/* Rendered on server (page.tsx) hopefully in the right way*/}
                    <EndlessScroll
                        pagingContext={DynamicImageCollectionPagingContext}
                        loadingInfoClassName="loading-control"
                        renderer={
                            (collection, i) => (
                                <CollectionCardLink key={i} collection={collection} />
                            )
                        }
                    />
                </div>
            ) : (
                <div className={gridClassName}>
                    {renderSpecialCollections()}
                </div>
            )}
        </div>
    )
}
