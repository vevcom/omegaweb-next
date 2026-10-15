'use client'

import { usePageTitle } from './PageTitle'
import { useEffect } from 'react'
import type { PageTitle } from './PageTitle'

export default function PageTitleSetter({ title, subtitle }: PageTitle) {
    const { setTitle } = usePageTitle()
    useEffect(() => {
        setTitle({ title, subtitle })
        return () => setTitle({ title: '' })
    }, [title, subtitle, setTitle])
    return null
}
