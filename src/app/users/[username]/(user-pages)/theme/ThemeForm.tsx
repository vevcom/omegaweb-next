'use client'

import styles from './page.module.scss'
import { themes, themeLabels, applyTheme } from '@/lib/theme'
import { updateUserThemeAction } from '@/services/users/actions'
import { useRef, useState } from 'react'
import type { Theme } from '@/lib/theme'

type PropTypes = {
    username: string,
    activeTheme: Theme,
}

export default function ThemeForm({ username, activeTheme }: PropTypes) {
    const [selectedTheme, setSelectedTheme] = useState(activeTheme)
    // One save at a time: overlapping saves could land out of order, and a late failure would roll
    // back over a newer choice.
    const saving = useRef(false)

    async function selectTheme(theme: Theme) {
        if (saving.current) return
        saving.current = true
        const previousTheme = selectedTheme
        // Repaint first so the choice is instant, then store it. The next page load gets the theme
        // from the server, so a failed save must put the old one back.
        setSelectedTheme(theme)
        applyTheme(theme)
        const result = await updateUserThemeAction({ params: { username } }, { data: { theme } }).catch(() => null)
        if (!result?.success) {
            setSelectedTheme(previousTheme)
            applyTheme(previousTheme)
        }
        saving.current = false
    }

    return (
        <div className={styles.ThemeWrapper}>
            {Object.entries(themes).map(([name, colors]) => {
                const bg = (key: keyof typeof colors) => ({ backgroundColor: colors[key] })
                return (
                    <a
                        key={name}
                        className={`${styles.Theme} ${name === selectedTheme ? styles.active : ''}`}
                        onClick={() => selectTheme(name as Theme)}
                    >
                        <div className={styles.ThemeHeader}>
                            {themeLabels[name as Theme]}
                        </div>
                        <div className={styles.ThemeContent}>
                            <div className={styles.ThemeBody}>
                                {Object.entries(colors).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className={styles.ColorSwatch}
                                        style={{ backgroundColor: value }}
                                        title={`${key}: ${value}`}
                                    />
                                ))}
                            </div>
                            <div
                                className={styles.ThemePreview}
                                style={{
                                    background: 'linear-gradient(125deg, '
                                        + `color-mix(in srgb, ${colors['accent-blue']}, transparent 70%) 0%, `
                                        + `color-mix(in srgb, ${colors['surface-base']}, transparent 80%) 70%), ${
                                            colors['surface-raised']}`,
                                }}
                            >
                                <div className={styles.PreviewNavBar} style={bg('surface-base')}>
                                    <span className={styles.PreviewLogo} style={bg('accent-blue')} />
                                    <span className={styles.PreviewTitle} style={bg('text-muted')} />
                                    <span className={styles.PreviewNavGrower} />
                                    <span className={styles.PreviewNavIcon} style={bg('text-muted')} />
                                    <span className={styles.PreviewNavIcon} style={bg('accent-blue')} />
                                </div>
                                <div className={styles.PreviewBody}>
                                    <div className={styles.PreviewSideBar} style={bg('surface-base')}>
                                        <span className={styles.PreviewSideIcon} style={bg('accent-blue')} />
                                        <span className={styles.PreviewSideIcon} style={bg('text-muted')} />
                                        <span className={styles.PreviewSideIcon} style={bg('text-muted')} />
                                        <span className={styles.PreviewSideIcon} style={bg('text-muted')} />
                                    </div>
                                    <div className={styles.PreviewCard} style={bg('surface-base')}>
                                        <span className={styles.PreviewHeading} style={bg('ink-strong')} />
                                        <span className={styles.PreviewText} style={bg('text-muted')} />
                                        <span className={styles.PreviewText} style={bg('text-muted')} />
                                        <span className={styles.PreviewButton} style={bg('accent-blue')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                )
            })}
        </div>
    )
}
