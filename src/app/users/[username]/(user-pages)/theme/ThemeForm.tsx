'use client'

import { Theme, themes, themeLabels } from '@/lib/theme'
import { updateUserThemeAction } from '@/services/users/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'

type PropTypes = {
    username: string,
    activeTheme: Theme,
}

// A tiny, static mockup of the actual app chrome (nav bar, icon sidebar, content card) rendered in the
// theme's own colors, so you can see roughly what the theme looks like before applying it, without
// actually switching the live CSS variables.
const preview = {
    root: 'shrink-0 w-full max-w-112 p-2 rounded-round overflow-hidden flex flex-col gap-2 shadow-soft',
    navBar: 'shrink-0 flex items-center gap-2 py-2 px-3 rounded-[calc(var(--rounding)/2)]',
    logo: 'shrink-0 size-4 rounded-[calc(var(--gap)/2)]',
    title: 'h-[calc(0.6*var(--gap))] w-16 rounded-[calc(0.3*var(--gap))] opacity-60',
    navGrower: 'flex-1',
    navIcon: 'shrink-0 size-3 rounded-full opacity-60',
    body: 'flex-1 flex items-stretch gap-2',
    sideBar: 'shrink-0 w-6 flex flex-col items-center gap-1.5 p-1.5 rounded-[calc(var(--rounding)/2)]',
    sideIcon: 'size-3 rounded-[calc(0.3*var(--gap))] opacity-60',
    card: 'flex-1 p-3 rounded-[calc(var(--rounding)/2)] flex flex-col gap-[calc(0.6*var(--gap))]',
    heading: 'h-[calc(0.9*var(--gap))] w-1/2 rounded-[calc(0.3*var(--gap))]',
    text: 'h-[calc(0.6*var(--gap))] w-[85%] rounded-[calc(0.3*var(--gap))] opacity-70',
    button: 'mt-[calc(0.6*var(--gap))] h-4 w-16 rounded-[calc(0.4*var(--gap))]',
}

/**
 * One form per theme, each carrying its theme in a hidden field. Choosing one stores it and
 * refreshes the page, and the root layout then renders the new theme - there is no client-side
 * repainting to keep in step with the server.
 */
export default function ThemeForm({ username, activeTheme }: PropTypes) {
    const action = configureAction(updateUserThemeAction, { params: { username } })

    return (
        <div className="flex flex-col gap-2">
            {Object.values(Theme).map(theme => {
                const colors = themes[theme]
                const bg = (key: keyof typeof colors) => ({ backgroundColor: colors[key] })
                return (
                    <Form
                        key={theme}
                        className={[
                            'w-full bg-surface-base rounded-round border-2 p-4 transition-[border-color,box-shadow] duration-300 ease-[ease] overflow-hidden flex flex-col gap-4',
                            theme === activeTheme ? 'border-accent-blue' : 'border-transparent',
                        ].join(' ')}
                        action={action}
                        refreshOnSuccess
                        submitText="Velg tema"
                    >
                        <input type="hidden" name="theme" value={theme} />
                        <div className="bg-surface-raised -mx-4 -mt-4 mb-0 p-4 text-xl text-ink-hover">
                            {themeLabels[theme]}
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 flex flex-wrap content-start gap-1.5">
                                {Object.entries(colors).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="shrink-0 rounded-round size-8"
                                        style={{ backgroundColor: value }}
                                        title={`${key}: ${value}`}
                                    />
                                ))}
                            </div>
                            <div
                                className={preview.root}
                                style={{
                                    background: 'linear-gradient(125deg, '
                                        + `color-mix(in srgb, ${colors['accent-blue']}, transparent 70%) 0%, `
                                        + `color-mix(in srgb, ${colors['surface-base']}, transparent 80%) 70%), ${
                                            colors['surface-raised']}`,
                                }}
                            >
                                <div className={preview.navBar} style={bg('surface-base')}>
                                    <span className={preview.logo} style={bg('accent-blue')} />
                                    <span className={preview.title} style={bg('text-muted')} />
                                    <span className={preview.navGrower} />
                                    <span className={preview.navIcon} style={bg('text-muted')} />
                                    <span className={preview.navIcon} style={bg('accent-blue')} />
                                </div>
                                <div className={preview.body}>
                                    <div className={preview.sideBar} style={bg('surface-base')}>
                                        <span className={preview.sideIcon} style={bg('accent-blue')} />
                                        <span className={preview.sideIcon} style={bg('text-muted')} />
                                        <span className={preview.sideIcon} style={bg('text-muted')} />
                                        <span className={preview.sideIcon} style={bg('text-muted')} />
                                    </div>
                                    <div className={preview.card} style={bg('surface-base')}>
                                        <span className={preview.heading} style={bg('ink-strong')} />
                                        <span className={preview.text} style={bg('text-muted')} />
                                        <span className={preview.text} style={bg('text-muted')} />
                                        <span className={preview.button} style={bg('accent-blue')} />
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
