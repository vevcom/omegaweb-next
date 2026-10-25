'use client'
import Checkbox from '@/UI/Checkbox'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'

type PropTypes = {
    showOnlyCollectionsSessionAdministrates: boolean,
}

/**
 * The switch deciding whether the collection listing shows every collection the session may see, or
 * only the ones it administrates.
 *
 * The value is kept in the url rather than only in the paging context, because the first page of
 * collections is rendered on the server - setting the details client side alone would leave those
 * server rendered cards unfiltered and page on from a cursor outside the filtered set.
 * @param showOnlyCollectionsSessionAdministrates - the value currently in effect
 * @returns
 */
export default function ToggleShowAdminCollections({
    showOnlyCollectionsSessionAdministrates
}: PropTypes) {
    const { replace } = useRouter()

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        replace(`/image-collections/?${QueryParams.onlyAdministratedCollections.encodeUrl(event.target.checked)}`)
    }

    return (
        <span className="flex items-center text-m">
            <Checkbox
                name="onlyAdministratedCollections"
                label="Bare samlinger jeg administrerer"
                checked={showOnlyCollectionsSessionAdministrates}
                onChange={handleChange}
            />
        </span>
    )
}
