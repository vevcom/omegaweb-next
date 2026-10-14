import { themeCss } from '@/lib/theme'
import type { ThemeColors } from '@/lib/theme'

type PropTypes = {
    /** What tells one theme from another, e.g. the Theme enum value. */
    name: string,
    colors: ThemeColors,
}

/**
 * Sets a theme for the whole document: its variables on :root, and the colour of the browser
 * chrome. React hoists both into <head>, so a layout below the root can set the theme for the
 * pages under it, and the first paint has it rather than the default theme in globals.scss.
 * Picking another theme refreshes the page, which renders it anew.
 */
export default function SiteTheme({ name, colors }: PropTypes) {
    return (
        <>
            <meta name="theme-color" content={colors['surface-base']} />
            <style href={`theme-${name}`} precedence="theme">{themeCss(colors)}</style>
        </>
    )
}
