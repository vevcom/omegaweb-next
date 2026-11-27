import Card from '@/components/UI/Card'
import type { ReactNode } from 'react'

export default function UserProfileSettingsCard({ children } : {children:ReactNode}) {
    return (
        <Card className="text-base-content">
            {children}
        </Card>
    )
}
