'use client'

import styles from './page.module.scss'
import { Theme, themes, themeLabels } from '@/lib/theme'
import { updateUserThemeAction } from '@/services/users/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'

type PropTypes = {
    username: string,
    activeTheme: Theme,
}

/**
 * One form per theme, each carrying its theme in a hidden field. Choosing one stores it and
 * refreshes the page, and the root layout then renders the new theme - there is no client-side
 * repainting to keep in step with the server.
 */
export default function ThemeForm({ username, activeTheme }: PropTypes) {
    const action = configureAction(updateUserThemeAction, { params: { username } })

    return (
        <div className={styles.ThemeWrapper}>
            {Object.values(Theme).map(theme => {
                const colors = themes[theme]
                const bg = (key: keyof typeof colors) => ({ backgroundColor: colors[key] })
                return (
                    <Form
                        key={theme}
                        className={`${styles.Theme} ${theme === activeTheme ? styles.active : ''}`}
                        action={action}
                        refreshOnSuccess
                        submitText="Velg tema"
                    >
                        <input type="hidden" name="theme" value={theme} />
                        <div className={styles.ThemeHeader}>
                            {themeLabels[theme]}
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
                    </Form>
                )
            })}
        </div>
    )
}
