'use client'
import { FormContext } from './FormContext'
import { TabPanel, useTabs } from '@/components/UI/Tabs'
import { useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * A part of a Form on a tab of its own. The inputs stay in the one Form, which holds their values
 * and submits them together. A tab with an input the server refused is marked and brought forward,
 * and so is one with an input the browser will not submit. Put the inputs in FormSections, which
 * show their errors.
 */
export default function FormTab({ tab, children }: { tab: string, children: ReactNode }) {
    const form = useContext(FormContext)
    if (!form) throw new Error('FormTab må ligge inni et Form')
    const { reportErrors, show } = useTabs()
    const contentRef = useRef<HTMLDivElement>(null)

    // The browser stops a save on an input it finds invalid, and can only say why on one that is
    // showing. `invalid` does not bubble, so it is caught on its way down, and the tab is showing
    // by the time the browser points at the input. It points at the first, whose tab `show` keeps.
    useEffect(() => {
        const content = contentRef.current
        if (!content) return undefined
        const showTab = () => show(tab)
        content.addEventListener('invalid', showTab, true)
        return () => content.removeEventListener('invalid', showTab, true)
    }, [show, tab])

    // Looked up in the page, not among the children: the inputs of a tab are often rendered by
    // components further down, which the children given here say nothing about. A field placed
    // straight in the tab has its error shown with the general ones, and marks the tab all the same.
    useEffect(() => {
        const hasErrors = form.refusedNames.some(name => {
            const escaped = CSS.escape(name)
            return contentRef.current?.querySelector(`[name="${escaped}"], [id="${escaped}"]`)
        })
        reportErrors(tab, hasErrors)
    }, [form.refusedNames, reportErrors, tab])

    return <TabPanel tab={tab}>
        <div ref={contentRef}>{children}</div>
    </TabPanel>
}
