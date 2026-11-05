'use client'
import { FormContext } from './FormContext'
import { TabPanel, useTabs } from '@/components/UI/Tabs'
import { useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * A part of a Form on a tab of its own. The inputs stay in the one Form, which holds their values
 * and submits them together. A tab with an input the server refused is marked and brought forward.
 * Put the inputs in FormSections, which show their errors.
 */
export default function FormTab({ tab, children }: { tab: string, children: ReactNode }) {
    const form = useContext(FormContext)
    if (!form) throw new Error('FormTab må ligge inni et Form')
    const { reportErrors } = useTabs()
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const hasErrors = Object.keys(form.inputErrors).some(name => {
            const escaped = CSS.escape(name)
            return contentRef.current?.querySelector(`[name="${escaped}"], [id="${escaped}"]`)
        })
        reportErrors(tab, hasErrors)
    }, [form.inputErrors, reportErrors, tab])

    return <TabPanel tab={tab}>
        <div ref={contentRef}>{children}</div>
    </TabPanel>
}
