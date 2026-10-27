import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import HeaderSearch from '@/components/HeaderItems/HeaderSearch'
import React from 'react'

export default function PageWrapper({
    children,
    headerItem,
    fillHeight = false,
    hideTitle = false,
    transparent = false,
    className,
    search,
}: {
    children: React.ReactNode,
    headerItem?: React.ReactNode,
    /** Shows a search in the header, written to the `search` query param for the page to filter on. */
    search?: { value: string, label?: string, shallow?: boolean },
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
                    {search ? (
                        <div className="flex-wrap gap-2">
                            <HeaderSearch defaultValue={search.value} label={search.label} shallow={search.shallow} />
                            <div className="flex-1 min-w-0 flex items-center justify-end">
                                { headerItem }
                            </div>
                        </div>
                    ) : (
                        <div>
                            { headerItem }
                        </div>
                    )}
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
