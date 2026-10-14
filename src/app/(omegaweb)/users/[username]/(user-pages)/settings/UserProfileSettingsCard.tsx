import styles from './UserProfileSettingsCard.module.scss'
import type { ReactNode } from 'react'

export default function UserProfileSettingsCard({ children } : {children:ReactNode}) {
    return (
        <div className={styles.settingsCard}>
            {children}
        </div>
    )
}
