'use client'
import { readChatProfilesAction } from '@/services/chat/users/actions'
import { MAX_CHAT_PROFILES_AT_ONCE } from '@/services/chat/users/constants'
import { useEffect, useRef, useState } from 'react'
import type { ChatProfile } from '@/services/chat/users/types'

/**
 * Who the people of a room are here, by their Matrix ids, asked of the app as they turn up. One
 * the app does not know is not in it, and is shown as the homeserver names them, as everyone is
 * when the app does not answer.
 */
export default function useChatProfiles(matrixUserIds: readonly string[]): ReadonlyMap<string, ChatProfile> {
    const [profiles, setProfiles] = useState<ReadonlyMap<string, ChatProfile>>(new Map())
    const asked = useRef(new Set<string>())

    useEffect(() => {
        const toAsk = matrixUserIds
            .filter(matrixUserId => !asked.current.has(matrixUserId))
            .slice(0, MAX_CHAT_PROFILES_AT_ONCE)
        if (toAsk.length === 0) return
        toAsk.forEach(matrixUserId => asked.current.add(matrixUserId))
        void readChatProfilesAction({ params: { matrixUserIds: toAsk } }).then(answer => {
            if (!answer.success) return
            setProfiles(known => {
                const withAnswer = new Map(known)
                answer.data.forEach(profile => withAnswer.set(profile.matrixUserId, profile))
                return withAnswer
            })
        }).catch(() => undefined)
    }, [matrixUserIds, profiles])

    return profiles
}
