import { NavBarTitle, PageWrapper } from '@ohma/ui'
import type { ReactNode } from 'react'

/**
 * NavBarTitle reads the title out of PageTitleContext, which is written by
 * PageWrapper (via PageTitleSetter). With no page mounted it deliberately
 * renders a fixed-height placeholder instead, to avoid hydration layout shift —
 * so both states have to be shown through a real page.
 */
const Bar = ({ children }: { children: ReactNode }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '64px',
        padding: '0 1rem',
        background: 'var(--color-base-200)',
        borderRadius: 'var(--rounding)',
    }}>
        {children}
    </div>
)

export const WithPageTitle = () => (
    <>
        <Bar><NavBarTitle /></Bar>
        <div style={{ display: 'none' }}>
            <PageWrapper title="Hvad der hender" hideTitle><span /></PageWrapper>
        </div>
    </>
)

export const PlaceholderWithNoTitle = () => (
    <>
        <p style={{ margin: '0 0 0.5rem', color: 'var(--color-base-content)' }}>
            No page title set — renders a reserved-space placeholder:
        </p>
        <Bar><NavBarTitle /></Bar>
    </>
)
