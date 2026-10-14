'use client'

import styles from './NavBar.module.scss'
import { usePageTitle } from '@/contexts/PageTitle'
import React from 'react'

export default function NavBarTitle() {
    const { title, subtitle } = usePageTitle()
    if (!title) {
        return (
            <div className={styles.pageTitlePlaceholder} aria-hidden={true}>
                {/* server-consistent placeholder to avoid layout shift during hydration */}
            </div>
        )
    }

    return (
        <div className={styles.pageTitle} aria-hidden={false}>
            {title}
            {subtitle && <span className={styles.pageSubtitle}> | {subtitle}</span>}
        </div>
    )
}
