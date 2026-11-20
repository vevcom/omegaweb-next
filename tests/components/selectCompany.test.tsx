import SelectCompany from '@/components/Company/SelectCompany'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { describe, expect, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Company } from '@/prisma-generated-pn-types'

const company = { id: 7, name: 'Velgbar AS' } as Company

describe('the button that picks a company on its card', () => {
    test('is named for the company it picks', () => {
        const markup = renderToStaticMarkup(
            <CompanySelectionProvider company={null}>
                <SelectCompany company={company} />
            </CompanySelectionProvider>
        )
        expect(markup).toContain('aria-label="Velg Velgbar AS"')
        expect(markup).toContain('aria-pressed="false"')
        expect(renderToStaticMarkup(
            <CompanySelectionProvider company={company}>
                <SelectCompany company={company} />
            </CompanySelectionProvider>
        )).toContain('aria-pressed="true"')
    })
})
