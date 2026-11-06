import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import TermsArticle from '@/components/Terms/TermsArticle'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Vilkår og personvern',
    description: 'Vilkår for bruk av Veven og personvernerklæring for Sanctus Omega Broderskab.',
}

export default function Terms() {
    return (
        <PageWrapper>
            <PageTitleSetter title="Vilkår og personvern" />
            <TermsArticle />
        </PageWrapper>
    )
}
