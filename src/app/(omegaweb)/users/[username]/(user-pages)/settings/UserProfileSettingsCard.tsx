import type { ReactNode } from 'react'

export default function UserProfileSettingsCard({ children } : {children:ReactNode}) {
    return (
        <div className="bg-base-100 rounded-round p-(--card-padding) text-base-content">
            {children}
        </div>
    )
}
