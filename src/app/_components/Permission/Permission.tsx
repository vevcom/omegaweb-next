import styles from './Permission.module.scss'
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
        <div className={`${styles.Permission} ${className}`}>
            {children}
            <div className={styles.content}>
                <div className={styles.name}>
                    <h3>{permissionInfo.name}</h3> <i>({permission})</i>
                </div>
                <div className={styles.info}>
                    <p>{permissionInfo.description}</p>
                    {displayCategory ? <><p> - </p><i>{permissionInfo.category}</i></> : <></>}
                </div>
            </div>
        </div>
    )
}
