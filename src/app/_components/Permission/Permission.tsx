import { permissionConfig } from '@/services/permissions/constants'
import type { ReactNode } from 'react'
import type { Permission as PermissionT } from '@/prisma-generated-pn-types'

type PropTypes = {
    permission: PermissionT
    displayCategory?: boolean
    children?: ReactNode
    className?: string
}

/**
 * Display a permission in a nice way by getting info from the permission config object.
 * @param permission - The permission to display ex. USERS_USE
 * @param children - Displayed to the LEFT of the content
 * @param displayCategory - Display which category the permission is from (default true)
 * @returns
 */
export default function Permission({ permission, children, displayCategory = true, className }: PropTypes) {
    const permissionInfo = permissionConfig[permission]

    return (
        <div className={`
            bg-surface-raised flex round items-center gap-[1em]
            ${className}
        `}>
            {children}
            <div className="flex flex-col min-w-0">
                <div className="
                    flex flex-wrap items-center gap-[.4em]
                    [&>h3]:text-l
                    [&>i]:text-s [&>i]:wrap-anywhere
                ">
                    <h3>{permissionInfo.name}</h3> <i>({permission})</i>
                </div>
                <div className="flex items-center gap-[.3em]">
                    <p>{permissionInfo.description}</p>
                    {displayCategory ? <><p> - </p><i>{permissionInfo.category}</i></> : <></>}
                </div>
            </div>
        </div>
    )
}
