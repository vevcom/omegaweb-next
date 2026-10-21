'use client'
import TextInput from '@/UI/TextInput'
import { useDebounce } from '@/hooks/useDebounce'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'

type PropTypes = {
    currentName: string
}

export default function CompanyListFilter({ currentName }: PropTypes) {
    const { replace } = useRouter()
    const { setDetails } = useContext(CompanyPagingContext) ?? {
        setDetails: () => {}
    }
    const setNameFilter = useDebounce((name: string) => {
        replace(`/career/companies/?${QueryParams.companyName.encodeUrl(name)}`)
        setDetails({ name })
    }, 300)
    return (
        <span className="flex flex-row flex-nowrap items-center gap-3 w-full max-w-[360px]">
            <FontAwesomeIcon className="shrink-0 text-text-muted" icon={faSearch} />
            <TextInput
                name="name"
                onChange={(e) => setNameFilter(e.target.value)}
                defaultValue={currentName}
                label="Søk etter bedrift"
            />
        </span>
    )
}
