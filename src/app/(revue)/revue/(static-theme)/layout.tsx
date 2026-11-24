import RevueShell from '@/app/(revue)/_components/RevueShell'
import { revueTheme } from '@/app/(revue)/_lib/revueTheme'
import type { ReactNode } from 'react'

export default function RevueStaticThemeLayout({ children }: { children: ReactNode }) {
    return <RevueShell theme={revueTheme}>{children}</RevueShell>
}
