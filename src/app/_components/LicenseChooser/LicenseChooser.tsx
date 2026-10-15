'use client'
import { SelectNumberPossibleNULL } from '@/UI/Select'
import { readAllLicensesAction } from '@/services/licenses/actions'
import useActionCall from '@/hooks/useActionCall'
import { useCallback, useEffect, useState, useEffectEvent } from 'react'

type PropTypes = {
    defaultLicenseName?: string | null
    name?: string
}

/**
 * A component to choose a license. It makes a CLIENT SIDE request to the server to get the licenses
 * @param name - the form field name of the selection (defaults to "licenseId")
 * @returns A component to choose a license
 */
export default function LicenseChooser({ defaultLicenseName, name = 'licenseId' }: PropTypes) {
    const action = useCallback(() => readAllLicensesAction(), [])
    const { data } = useActionCall(action)

    const [licenseId, setLicenseId] = useState<number | 'NULL'>('NULL')

    const updateLicenseId = useEffectEvent(() => {
        if (!defaultLicenseName) return
        const license = data?.find(licns => licns.name === defaultLicenseName)
        if (license) {
            setLicenseId(license.id)
        }
    })

    useEffect(() => {
        updateLicenseId()
    }, [defaultLicenseName, data])

    return (
        <SelectNumberPossibleNULL
            name={name}
            label="Lisens"
            className="w-[200px]"
            options={
                [
                    { value: 'NULL', label: 'Ingen lisens' },
                    ...(data?.map(license => ({ value: license.id, label: license.name })) ?? [])
                ] as const
            }
            value={licenseId}
            onChange={setLicenseId}
        />
    )
}
