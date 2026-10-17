'use client'
import styles from './CompanyChooser.module.scss'
import CompanyList from '@/components/Company/CompanyList'
import TextInput from '@/components/UI/TextInput'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import Link from 'next/link'
import { useContext } from 'react'
import type { ChangeEvent } from 'react'

type PropTypes = {
    className?: string
}

export default function CompanyChooser({ className }: PropTypes) {
    const companyPagingCtx = useContext(CompanyPagingContext)

    if (!companyPagingCtx) {
        throw new Error('CompanyPagingContext er ikke definert')
    }

    const handleNameFilter = (e: ChangeEvent<HTMLInputElement>) => {
        companyPagingCtx.setDetails({ name: e.target.value })
    }

    return (
        <div className={`${styles.CompanyChooser} ${className ?? ''}`}>
            <div className={styles.header}>
                <TextInput className={styles.filter} label="Søk Navn" name="name" onChange={handleNameFilter} />
                <Link href="/career/companies">Administrer bedrifter</Link>
            </div>
            <div className={styles.list}>
                <CompanyList disableEditing serverRenderedData={[]} />
            </div>
        </div>
    )
}
