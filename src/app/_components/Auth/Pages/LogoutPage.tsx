import LogOut from './LogOut'
import type { AuthPagesConfig } from './authPages'

export function logoutPage(config: AuthPagesConfig) {
    return function LogoutPage() {
        return <LogOut callbackUrl={config.afterLogoutPath} />
    }
}
