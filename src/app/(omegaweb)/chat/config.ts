import { Site } from '@/lib/sites/site'
import type { PagesMount } from '@/lib/sites/defineLinks'

/** The chat pages of Omega's site. */
export const chatPages: PagesMount = { site: 'OMEGAWEB', mountPath: '/chat' }

/** Whether an app path, with or without a query, is that of a chat page. */
export function isChatPagePath(appPath: string): boolean {
    const root = Site.of(chatPages.site).pagesPath(chatPages.mountPath)
    const [pathname] = appPath.split(/[?#]/, 1)
    return pathname === root || pathname.startsWith(`${root}/`)
}
