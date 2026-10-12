import Company from './Company'
import type { CompanyExpanded } from '@/services/career/companies/types'

/**
 * Used to render companies server side and client side in consistent way
 * @param disableEditing - If the edit buttons should be left out even for a user with the rights
 * @returns A function that takes a company and returns a Company component
 */
export const companyListRenderer = ({
    disableEditing = false
}: {
    disableEditing?: boolean
// eslint-disable-next-line react/display-name
} = {}) => (company: CompanyExpanded) =>
    <Company disableEdit={disableEditing} key={company.id} company={company} />
