'use client'
import { readChatUserPageAction } from '@/services/chat/users/actions'
import { useCallback, useRef } from 'react'
import type { UserBasic, UserPageReader } from '@/services/users/types'

/**
 * Those a conversation can be started with, for `PickUsersPopUp`: `readPage` reads them for its
 * list, and `matrixIdOf` gives the Matrix id of one of them, which each page came with.
 */
export default function useChatUsersToPick() {
    const matrixIds = useRef(new Map<number, string>())

    const readPage = useCallback<UserPageReader>(async page => {
        const answer = await readChatUserPageAction(page)
        if (answer.success) answer.data.forEach(user => matrixIds.current.set(user.id, user.matrixUserId))
        return answer
    }, [])
    const matrixIdOf = useCallback((user: UserBasic) => matrixIds.current.get(user.id), [])

    return { readPage, matrixIdOf }
}
