'use client'
import { readDefaultPermissionsAction } from '@/services/permissions/actions'
import { readAllStandardImagesAction } from '@/services/images/standard/actions'
import { readExpandedGroupsOfAllTypesAction } from '@/services/groups/actions'
import { specialImagePanels } from '@/services/images/specialPanels/constants'
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { ErrorCode } from '@/services/error'
import type { ExpandedGroupsOfAllTypes } from '@/services/groups/types'
import type { ExpandedImage, ExpandedImageCollection } from '@/services/images/subservice/types'
import type { Permission, StandardImage } from '@/prisma-generated-pn-types'
import type { ReactNode } from 'react'
import type { SessionMaybeUser } from '@/auth/session/Session'

type ClientDataResult<Key extends string, Data> =
    | { status: 'loading' }
    | { status: 'error', errorCode: ErrorCode }
    | ({ status: 'success' } & { [P in Key]: Data })

type ClientDataContext = {
    defaultPermissions: ClientDataResult<'defaultPermissions', Permission[]> | null,
    standardImages: ClientDataResult<'standardImages', Record<StandardImage, ExpandedImage>> | null,
    groups: ClientDataResult<'groups', ExpandedGroupsOfAllTypes> | null,
    specialCollections: ClientDataResult<'specialCollections', ExpandedImageCollection[]> | null,
    loadDefaultPermissions: () => void,
    loadStandardImages: () => void,
    loadGroups: () => void,
    loadSpecialCollections: () => void,
}

const ClientDataContext = createContext<ClientDataContext | null>(null)

type PropTypes = {
    children: ReactNode,
    session: SessionMaybeUser,
    defaultPermissions?: Permission[],
    standardImages?: Record<StandardImage, ExpandedImage>,
    groups?: ExpandedGroupsOfAllTypes,
    specialCollections?: ExpandedImageCollection[],
}

/**
 * The single client-side cache for shared server data. Main Layout may seed
 * the cach from server-side data, but the cache will be updated on the client side as needed.
 */
export default function ClientDataProvider({
    children,
    session,
    ...initialData
}: PropTypes) {
    const [defaultPermissions, setDefaultPermissions] = useState<
        ClientDataResult<'defaultPermissions', Permission[]> | null
    >(
        initialData.defaultPermissions
            ? { status: 'success', defaultPermissions: initialData.defaultPermissions }
            : null
    )
    const [standardImages, setStandardImages] = useState<
        ClientDataResult<'standardImages', Record<StandardImage, ExpandedImage>> | null
    >(
        initialData.standardImages
            ? { status: 'success', standardImages: initialData.standardImages }
            : null
    )
    const [groups, setGroups] = useState<
        ClientDataResult<'groups', ExpandedGroupsOfAllTypes> | null
    >(
        initialData.groups
            ? { status: 'success', groups: initialData.groups }
            : null
    )
    const [specialCollections, setSpecialCollections] = useState<
        ClientDataResult<'specialCollections', ExpandedImageCollection[]> | null
    >(
        initialData.specialCollections
            ? { status: 'success', specialCollections: initialData.specialCollections }
            : null
    )

    const defaultPermissionsInFlight = useRef(false)
    const loadDefaultPermissions = useCallback(async () => {
        if (defaultPermissionsInFlight.current) return
        defaultPermissionsInFlight.current = true
        setDefaultPermissions({ status: 'loading' })
        const res = await readDefaultPermissionsAction()
        setDefaultPermissions(
            res.success
                ? { status: 'success', defaultPermissions: res.data }
                : { status: 'error', errorCode: res.errorCode }
        )
        defaultPermissionsInFlight.current = false
    }, [])

    const standardImagesInFlight = useRef(false)
    const loadStandardImages = useCallback(async () => {
        if (standardImagesInFlight.current) return
        standardImagesInFlight.current = true
        setStandardImages({ status: 'loading' })
        const res = await readAllStandardImagesAction()
        setStandardImages(
            res.success
                ? { status: 'success', standardImages: res.data }
                : { status: 'error', errorCode: res.errorCode }
        )
        standardImagesInFlight.current = false
    }, [])

    const groupsInFlight = useRef(false)
    const loadGroups = useCallback(async () => {
        if (groupsInFlight.current) return
        groupsInFlight.current = true
        setGroups({ status: 'loading' })
        const res = await readExpandedGroupsOfAllTypesAction()
        setGroups(
            res.success
                ? { status: 'success', groups: res.data }
                : { status: 'error', errorCode: res.errorCode }
        )
        groupsInFlight.current = false
    }, [])

    const specialCollectionsInFlight = useRef(false)
    const loadSpecialCollections = useCallback(async () => {
        if (specialCollectionsInFlight.current) return
        specialCollectionsInFlight.current = true
        setSpecialCollections({ status: 'loading' })
        const authorizedPanels = Object.values(specialImagePanels).filter(
            panel => panel.auth.auth(session).authorized
        )
        const results = await Promise.all(authorizedPanels.map(panel => panel.readCollectionAction()))
        setSpecialCollections({
            status: 'success',
            specialCollections: results.flatMap(res => (res.success ? [res.data] : [])),
        })
        specialCollectionsInFlight.current = false
    }, [session])

    // Special collections are gated by the session's authorizers - if the session changes (e.g. a
    // permission update reaches the client through a router.refresh()) the cache must be dropped so
    // it gets re-authorized and re-read, rather than keep serving access decisions from the first load.
    const [previousSession, setPreviousSession] = useState(session)
    if (previousSession !== session) {
        setPreviousSession(session)
        setSpecialCollections(null)
    }

    return (
        <ClientDataContext.Provider value={{
            defaultPermissions,
            standardImages,
            groups,
            specialCollections,
            loadDefaultPermissions,
            loadStandardImages,
            loadGroups,
            loadSpecialCollections,
        }}>
            {children}
        </ClientDataContext.Provider>
    )
}

function useClientData(): ClientDataContext {
    const context = useContext(ClientDataContext)
    if (!context) throw new Error('ClientData hooks must be used within a ClientDataProvider')
    return context
}

export function useDefaultPermissions(): ClientDataResult<'defaultPermissions', Permission[]> {
    const { defaultPermissions, loadDefaultPermissions } = useClientData()
    useEffect(() => {
        if (defaultPermissions === null) loadDefaultPermissions()
    }, [defaultPermissions, loadDefaultPermissions])
    return defaultPermissions ?? { status: 'loading' }
}

export function useStandardImages(): ClientDataResult<'standardImages', Record<StandardImage, ExpandedImage>> {
    const { standardImages, loadStandardImages } = useClientData()
    useEffect(() => {
        if (standardImages === null) loadStandardImages()
    }, [standardImages, loadStandardImages])
    return standardImages ?? { status: 'loading' }
}

export function useGroups(): ClientDataResult<'groups', ExpandedGroupsOfAllTypes> {
    const { groups, loadGroups } = useClientData()
    useEffect(() => {
        if (groups === null) loadGroups()
    }, [groups, loadGroups])
    return groups ?? { status: 'loading' }
}

export function useSpecialCollections(): ClientDataResult<'specialCollections', ExpandedImageCollection[]> {
    const { specialCollections, loadSpecialCollections } = useClientData()
    useEffect(() => {
        if (specialCollections === null) loadSpecialCollections()
    }, [specialCollections, loadSpecialCollections])
    return specialCollections ?? { status: 'loading' }
}
