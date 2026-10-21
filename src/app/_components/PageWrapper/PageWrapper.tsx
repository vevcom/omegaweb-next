import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import React from 'react'

export default function PageWrapper({
    children,
    headerItem,
    fillHeight = false,
    hideTitle = false,
    transparent = false,
    className,
}: {
    children: React.ReactNode,
    headerItem?: React.ReactNode,
    fillHeight?: boolean,
    hideTitle?: boolean,
    /** For pages laid out as islands: drops the wrapper's surface-base panel so the page background shows through. */
    transparent?: boolean,
    /** Extra class for page-specific tweaks (e.g. rounding, spacing) without touching the shared default. */
    className?: string,
}) {
    const wrapperClass = `
        min-h-full size-full self-start
        [&_h1]:font-secondary [&_h1]:text-xxl [&_h1]:capitalize
        ${transparent ? 'bg-transparent' : 'bg-surface-base'}
        ${className}
    `
    const scrollerClass = `
        ${transparent ? 'p-0' : 'p-4'}
        ${fillHeight ? 'flex flex-col' : ''}
    `
    const headerClass = `
        flex flex-row justify-between items-center
        [&>div]:flex [&>div]:flex-row [&>div]:items-center [&>div]:flex-1
        has-[>div>*]:mb-4
        ${transparent ? 'pt-4 px-4' : ''}
        ${fillHeight ? 'shrink-0' : ''}
    `

    return (
        <ScrollArea className={wrapperClass} scrollerClassName={scrollerClass}>
            {!hideTitle && (
                <div className={headerClass}>
                    <div>
                        { headerItem }
                    </div>
                </div>
            )}

            <div className={`
                min-h-0
                ${fillHeight ? 'flex-1' : ''}
            `}>
                { children }
            </div>
        </ScrollArea>
    )
}
