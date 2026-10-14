'use client'
import styles from './SelectedCompany.module.scss'
import { CompanySelectionContext } from '@/contexts/CompanySelection'
import { useContext } from 'react'

/**
 * Component for displaying the selected company in the CompanySelectionContext
 * @returns The selected company
 */
export default function SelectedCompany() {
    const companyCtx = useContext(CompanySelectionContext)

    if (!companyCtx) {
        throw new Error('CompanySelectionContext eller companyPaging er ikke definert')
    }

    const company = companyCtx.selectedCompany

    return (
        <div className={`${styles.SelectedCompany} ${company ? '' : styles.empty}`}>
            <span className={styles.label}>Bedrift</span>
            <span className={styles.name}>{company ? company.name : 'Velg en bedrift i listen'}</span>
            {company && <input name="companyId" type="hidden" value={company.id} />}
        </div>
    )
}
