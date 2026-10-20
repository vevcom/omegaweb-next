'use client'

import { usePageTitle } from './PageTitle'
import { useEffect, useId } from 'react'
import type { PageTitle } from './PageTitle'

export default function PageTitleSetter({ title, subtitle }: PageTitle) {
    const id = useId()
    const { setTitle, removeTitle } = usePageTitle()
    useEffect(() => () => removeTitle(id), [id, removeTitle])
    useEffect(() => {
        setTitle(id, { title, subtitle })
    }, [id, title, subtitle, setTitle])
    return null
}
