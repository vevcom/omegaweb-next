import { themeCss } from '@/lib/theme'
import type { ThemeColors } from '@/lib/theme'

type PropTypes = {
    colors: ThemeColors,
}

/**
 * Sets a theme for the whole document: its variables on :root, and the colour of the browser
 * chrome. Rendered by a group layout, so each route group has its own, and server rendered, so
 * the first paint has it rather than the default theme in globals.scss.
 *
 * The style is deliberately not hoisted (no `precedence`): React never removes a hoisted
 * stylesheet, so after a visit to another group both themes would sit in <head> and the later one
 * would win. As an ordinary element it leaves with the layout that rendered it.
 */
export default function SiteTheme({ colors }: PropTypes) {
    return (
        <>
            {/* Hoisted into <head> by React, and removed again when the layout unmounts. */}
            <meta name="theme-color" content={colors['surface-base']} />
            <style>{themeCss(colors)}</style>
        </>
    )
}
