import SelectedCompany from '@/components/Company/SelectedCompany'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { describe, expect, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'

const inputOf = (markup: string) => /<input[^>]*name="companyId"[^>]*>/.exec(markup)?.[0] ?? null

describe('the company picked in a form', () => {
    test('has its input from the start, posting nothing while a company it needs is missing', () => {
        // A form reset is followed through the input's form, so the input must be there before a pick.
        const missing = inputOf(renderToStaticMarkup(
            <CompanySelectionProvider company={null}><SelectedCompany /></CompanySelectionProvider>
        ))
        expect(missing).toContain('disabled')

        const picked = inputOf(renderToStaticMarkup(
            <CompanySelectionProvider company={{ id: 3, name: 'Valgt AS' }}><SelectedCompany /></CompanySelectionProvider>
        ))
        expect(picked).toContain('value="3"')
        expect(picked).not.toContain('disabled')
    })
})
