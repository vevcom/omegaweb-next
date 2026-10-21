'use client'
import { CompanySelectionContext } from '@/contexts/CompanySelection'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useContext } from 'react'
import type { Company } from '@/prisma-generated-pn-types'

type PropTypes = {
    company: Company
}

/**
 * Component used in Company. If rendered inside CompanySelectionProvider, it will allow the user to select a company.
 * @param company The company to select when the button is clicked.
 */
export default function SelectCompany({ company }: PropTypes) {
    const companyCtx = useContext(CompanySelectionContext)
    if (!companyCtx) return <></>
    const isSelected = companyCtx.selectedCompany && companyCtx.selectedCompany.id === company.id
    return (
        <>
            <button className="opacity-0 size-full absolute top-0 left-0" onClick={() => {
                if (isSelected) {
                    companyCtx.setSelectedCompany(null)
                    return
                }
                companyCtx.setSelectedCompany(company)
            }} />
            <div className={`
                absolute top-0 right-0 size-[1.5em] text-text-inv rounded-full flex justify-center items-center
                ${isSelected ? 'bg-accent-blue' : 'bg-surface-raised'}
            `}>
                <FontAwesomeIcon icon={faCheck} />
            </div>
        </>
    )
}
