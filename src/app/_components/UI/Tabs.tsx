'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { ReactNode } from 'react'

export type TabDot = { level: 'ok' | 'warning' | 'missing', label: string }

const dotClassNames: Record<TabDot['level'], string> = {
    ok: 'bg-success',
    warning: 'bg-warning',
    missing: 'bg-error',
}

type TabsContextType = {
    active: string,
    /**
     * Brings a tab forward before anything else happens, for whoever needs it showing at once. Of
     * several asked for in one go, the first is the one shown.
     */
    show: (tab: string) => void,
    reportErrors: (tab: string, hasErrors: boolean) => void,
    reportDots: (dots: Record<string, TabDot>) => void,
}

const TabsContext = createContext<TabsContextType | null>(null)

export function useTabs() {
    const tabs = useContext(TabsContext)
    if (!tabs) throw new Error('TabPanel og FormTab må ligge inni Tabs')
    return tabs
}

export type Tab = { key: string, label: ReactNode, dot?: TabDot }

/**
 * A list of tabs with their panels as children. Panels stay mounted when hidden, so what is typed
 * in one survives moving to another. A panel may hold a whole Form, whose own FormTabs then share
 * this tab list, next to panels with forms of their own. A tab can carry a dot for how it stands,
 * which a panel can also report while its content changes. A refused input turns the dot red.
 */
export default function Tabs({ tabs, label, children }: {
    tabs: Tab[],
    label: string,
    children: ReactNode,
}) {
    const [selected, setSelected] = useState(tabs[0]?.key)
    const [erroredTabs, setErroredTabs] = useState<string[]>([])
    const [hadErrors, setHadErrors] = useState(false)
    const [reportedDots, setReportedDots] = useState<Record<string, TabDot>>({})

    // When errors appear where there were none, the first tab with one is brought forward.
    const hasErrors = erroredTabs.length > 0
    if (hasErrors !== hadErrors) {
        setHadErrors(hasErrors)
        const firstErrored = tabs.find(tab => erroredTabs.includes(tab.key))
        if (firstErrored) setSelected(firstErrored.key)
    }
    const active = tabs.some(tab => tab.key === selected) ? selected : tabs[0]?.key

    const showing = useRef(false)
    const show = useCallback((tab: string) => {
        if (showing.current) return
        showing.current = true
        setTimeout(() => {
            showing.current = false
        }, 0)
        flushSync(() => setSelected(tab))
    }, [])

    const reportErrors = useCallback((tab: string, tabHasErrors: boolean) => {
        setErroredTabs(errored => {
            if (errored.includes(tab) === tabHasErrors) return errored
            return tabHasErrors ? [...errored, tab] : errored.filter(other => other !== tab)
        })
    }, [])

    const reportDots = useCallback((dots: Record<string, TabDot>) => {
        setReportedDots(current => (JSON.stringify(current) === JSON.stringify(dots) ? current : dots))
    }, [])

    return <div className="
        grid gap-4 w-full h-full min-h-0
        mobile:grid-cols-[12rem_minmax(0,1fr)] mobile:grid-rows-[minmax(0,1fr)]
        max-mobile:grid-cols-[minmax(0,1fr)] max-mobile:grid-rows-[auto_minmax(0,1fr)]
    ">
        <div role="tablist" aria-label={label} aria-orientation="vertical" className="
            flex gap-1 min-w-0 p-2 rounded-inner bg-base-200
            mobile:flex-col
            max-mobile:overflow-x-auto
        ">
            {tabs.map(tab => {
                const isActive = tab.key === active
                const dot = erroredTabs.includes(tab.key)
                    ? { level: 'missing' as const, label: 'Noe her ble ikke godtatt' }
                    : reportedDots[tab.key] ?? tab.dot
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
                        ${isActive ? 'bg-primary text-primary-content font-bold' : `
                            bg-transparent text-base-content
                            hover:bg-base-300
                        `}
                    `}
                >
                    {tab.label}
                    {dot && <span
                        role="img"
                        aria-label={dot.label}
                        title={dot.label}
                        className={`
                            size-2.5 shrink-0 rounded-full
                            ${dotClassNames[dot.level]}
                        `}
                    />}
                </button>
            })}
        </div>
        <TabsContext.Provider value={{ active, show, reportErrors, reportDots }}>
            <div className="min-w-0 min-h-0 overflow-y-auto p-1">
                {children}
            </div>
        </TabsContext.Provider>
    </div>
}

/** The content of a tab, or of several tabs where it is what they share, such as the Form around their FormTabs. */
export function TabPanel({ tab, children }: { tab: string | string[], children: ReactNode }) {
    const { active } = useTabs()
    const keys = [tab].flat()
    return <div role="tabpanel" hidden={!keys.includes(active)} aria-labelledby={`tab-${keys[0]}`} className="h-full">
        {children}
    </div>
}
