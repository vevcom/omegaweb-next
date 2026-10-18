'use client'

import Bulshit from './Bulshit'
import { BulshitPagingContext } from '@/contexts/paging/BulshitPaging'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import React, { useContext } from 'react'

export type PropTypes = {
    serverRendered?: React.ReactNode,
}

export default function BulshitList({ serverRendered }: PropTypes) {
    const context = useContext(BulshitPagingContext)

    //This component must be rendered inside a OmegaquotePagingProvider
    if (!context) throw new Error('No context')

    return <>
        {serverRendered} {/* Rendered on server homefully in the right way*/}
        <EndlessScroll
            pagingContext={BulshitPagingContext}
            renderer={(quote, i) => <Bulshit key={i} quote={quote} />}
        />
    </>
}
