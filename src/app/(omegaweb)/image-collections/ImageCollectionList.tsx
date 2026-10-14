'use client'
import styles from './ImageCollectionList.module.scss'
import CollectionCardLink from '@/components/Image/Collection/CollectionCardLink'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import ModeSwitch from '@/UI/ModeSwitch'
import { DynamicImageCollectionPagingContext } from '@/contexts/paging/DynamicImageCollectionPaging'
import { useSpecialCollections } from '@/contexts/ClientData'
import { useState, type ReactNode } from 'react'

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
        <div className={styles.ImageCollectionList}>
            <div className={styles.modeSwitch}>
                <ModeSwitch
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'dynamic', label: 'Bildealbum' },
                        { value: 'special', label: 'Spesialsamlinger' },
                    ]}
                />
                {toggle && <div className={styles.toggle}>{toggle}</div>}
            </div>
            {mode === 'dynamic' ? (
                <div className={styles.grid}>
                    {serverRendered} {/* Rendered on server (page.tsx) hopefully in the right way*/}
                    <EndlessScroll
                        pagingContext={DynamicImageCollectionPagingContext}
                        loadingInfoClassName={styles.loadingControl}
                        renderer={
                            (collection, i) => (
                                <CollectionCardLink key={i} collection={collection} />
                            )
                        }
                    />
                </div>
            ) : (
                <div className={styles.grid}>
                    {renderSpecialCollections()}
                </div>
            )}
        </div>
    )
}
