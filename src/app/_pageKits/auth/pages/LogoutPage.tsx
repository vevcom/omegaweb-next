import LogOut from '@/pageKits/auth/components/LogOut'
import { authLinks } from '@/pageKits/auth/links'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

export function logoutPage(config: AuthPagesConfig) {
    return function LogoutPage() {
        return <LogOut callbackUrl={authLinks(config).afterLogout()} />
    }
}
