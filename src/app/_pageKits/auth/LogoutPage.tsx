import LogOut from './LogOut'
import { authLinks } from './links'
import type { AuthPagesConfig } from './config'

export function logoutPage(config: AuthPagesConfig) {
    return function LogoutPage() {
        return <LogOut callbackUrl={authLinks(config).afterLogout()} />
    }
}
