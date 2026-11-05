'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type TabsContextType = {
    active: string,
    reportErrors: (tab: string, hasErrors: boolean) => void,
}

const TabsContext = createContext<TabsContextType | null>(null)

export function useTabs() {
    const tabs = useContext(TabsContext)
    if (!tabs) throw new Error('TabPanel og FormTab må ligge inni Tabs')
    return tabs
}

export type Tab = { key: string, label: ReactNode }

/**
 * A list of tabs with their panels as children. Panels stay mounted when hidden, so what is typed
 * in one survives moving to another. A panel may hold a whole Form, whose own FormTabs then share
 * this tab list, next to panels with forms of their own.
 */
export default function Tabs({ tabs, label, children }: {
    tabs: Tab[],
    label: string,
    children: ReactNode,
}) {
    const [selected, setSelected] = useState(tabs[0]?.key)
    const [erroredTabs, setErroredTabs] = useState<string[]>([])
    const erroredRef = useRef<string[]>([])
    const active = tabs.some(tab => tab.key === selected) ? selected : tabs[0]?.key

    // Panels report in tab order, so the first one with an error is the one brought forward.
    const reportErrors = useCallback((tab: string, hasErrors: boolean) => {
        const errored = erroredRef.current
        if (errored.includes(tab) === hasErrors) return
        if (hasErrors && errored.length === 0) setSelected(tab)
        erroredRef.current = hasErrors ? [...errored, tab] : errored.filter(other => other !== tab)
        setErroredTabs(erroredRef.current)
    }, [])

    return <div className="
        grid gap-4 w-full
        mobile:grid-cols-[12rem_minmax(0,1fr)]
        max-mobile:grid-cols-[minmax(0,1fr)]
    ">
        <div role="tablist" aria-label={label} aria-orientation="vertical" className="
            flex gap-1 min-w-0 p-2 rounded-inner bg-surface-raised
            mobile:flex-col
            max-mobile:overflow-x-auto
        ">
            {tabs.map(tab => {
                const isActive = tab.key === active
                return <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`tab-${tab.key}`}
                    aria-selected={isActive}
                    onClick={() => setSelected(tab.key)}
                    className={`
                        flex items-center justify-between gap-2 px-3 py-2 shrink-0 border-none rounded-inner text-left
                        whitespace-nowrap cursor-pointer
                        ${isActive ? 'bg-accent-blue text-white font-bold' : `
                            bg-transparent text-text
                            hover:bg-surface-hover
                        `}
                    `}
                >
                    {tab.label}
                    {erroredTabs.includes(tab.key) && <span className="size-2 rounded-full bg-accent-red" />}
                </button>
            })}
        </div>
        <TabsContext.Provider value={{ active, reportErrors }}>
            <div className="min-w-0 p-1">
                {children}
            </div>
        </TabsContext.Provider>
    </div>
}

/** The content of a tab, or of several tabs where it is what they share, such as the Form around their FormTabs. */
export function TabPanel({ tab, children }: { tab: string | string[], children: ReactNode }) {
    const { active } = useTabs()
    const keys = [tab].flat()
    return <div role="tabpanel" hidden={!keys.includes(active)} aria-labelledby={`tab-${keys[0]}`}>
        {children}
    </div>
}
