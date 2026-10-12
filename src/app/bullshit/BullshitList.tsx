'use client'

import Bullshit from './Bullshit'
import { BullshitPagingContext } from '@/contexts/paging/BullshitPaging'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import React, { useContext } from 'react'

export type PropTypes = {
    serverRendered?: React.ReactNode,
}

export default function BullshitList({ serverRendered }: PropTypes) {
    const context = useContext(BullshitPagingContext)

    //This component must be rendered inside a OmegaquotePagingProvider
    if (!context) throw new Error('No context')

    return <>
        {serverRendered} {/* Rendered on server homefully in the right way*/}
        <EndlessScroll
            pagingContext={BullshitPagingContext}
            renderer={(quote, i) => <Bullshit key={i} quote={quote} />}
        />
    </>
}
