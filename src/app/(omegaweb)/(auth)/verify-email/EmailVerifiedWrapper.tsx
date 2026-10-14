import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import React from 'react'


export function EmailVerifiedWrapper({
    children,
}: {
    children: React.ReactNode,
}) {
    return <PageWrapper>
        <PageTitleSetter title="Epost er verifisert" />
        {children}
    </PageWrapper>
}
