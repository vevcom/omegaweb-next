'use client'

import Checkbox from '@/components/UI/Checkbox'
import { updateGroupPermissionAction } from '@/services/permissions/actions'
import { useState } from 'react'
import type { Permission } from '@/prisma-generated-pn-types'


export default function PermissionCheckbox({
    groupId,
    permission,
    value
}: {
    groupId: number,
    permission: Permission,
    value: boolean,
}) {
    const [hasPermission, setHasPermission] = useState(value)
    const [working, setWorking] = useState<boolean>(false)

    async function onClick() {
        setWorking(true)
        const result = await updateGroupPermissionAction({
            params: {
                groupId,
                permission,
            },
        }, {
            data: {
                value: !hasPermission,
            },
        })
        if (!result.success) {
            setWorking(false)
            throw new Error(result.errorCode)
        }

        setHasPermission(result.data)
        setWorking(false)
    }

    return <>
        {working ? <>
            ⏳
        </> : <Checkbox
            name="abcd"
            checked={hasPermission}
            onClick={onClick}
        />}
    </>
}
