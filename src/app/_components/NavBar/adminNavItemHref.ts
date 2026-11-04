import { appHref } from '@/lib/sites/href'
/**
 * Where the admin item of `navDef` points. Its own module so client components can pick the item
 * out without importing `navDef`, which pulls every page's authorizers - and the server-only code
 * behind them - into the client bundle.
 */
export const adminNavItemHref = appHref('/admin')
