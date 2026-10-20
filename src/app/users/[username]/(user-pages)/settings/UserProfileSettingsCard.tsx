import type { ReactNode } from 'react'

export default function UserProfileSettingsCard({ children } : {children:ReactNode}) {
    return (
        <div className="bg-surface-base rounded-round p-(--card-padding) text-text">
            {children}
        </div>
    )
}
