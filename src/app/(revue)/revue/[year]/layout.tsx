import { getRevue } from './getRevue'
import RevueShell from '@/app/(revue)/_components/RevueShell'
import { revueTheme, revueThemeOf } from '@/app/(revue)/_lib/revueTheme'
import { serverLayout, withFallback } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'

/**
 * A revue's pages, painted with the revue's own theme. A year that is no revue keeps the static theme,
 * and its page answers with the not-found page beside this layout.
 */
export default serverLayout({
    allowUnregistered: true,
    operation: ({ params }: LayoutOperationArgs<{ year: string }>) => withFallback(
        getRevue(params.year), null, ['NOT FOUND']
    ),
    render: ({ data: revue, children }) => (
        <RevueShell theme={revue ? revueThemeOf(revue) : revueTheme}>{children}</RevueShell>
    ),
})
