'use client'

import { usePageTitle } from '@/contexts/PageTitle'
import React from 'react'

export default function NavBarTitle() {
    const { title, subtitle } = usePageTitle()
    if (!title) {
        return (
            <div className="ml-2 w-[18ch] h-[48px] layer rounded-[calc(var(--rounding)/2)] inline-block" aria-hidden={true}>
                {/* server-consistent placeholder to avoid layout shift during hydration */}
            </div>
        )
    }

    return (
        <div
            className="ml-2 min-w-0 max-w-[40ch] text-xxl font-medium text-text whitespace-nowrap overflow-hidden text-ellipsis"
            aria-hidden={false}
        >
            {title}
            {subtitle && <span className="max-mobile:hidden"> | {subtitle}</span>}
        </div>
    )
}
