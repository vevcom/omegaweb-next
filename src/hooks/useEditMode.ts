'use client'
import useAuthorizer from './useAuthorizer'
import { EditModeContext } from '@/contexts/EditMode'
import { Require } from '@/auth/authorizer/Require'
import { useContext, useEffect, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { AuthResultTypeAny } from '@/auth/authorizer/AuthResult'

/**
 * This hook does the following:
 * - If the user is authorized, see the useAuthorizer hook, it will register the component in the edit mode context
 *   signaling that there is a editable component on the page. This causes the context to display the edit mode pencil.
 * - If the user is not authorized, it will not register the component in the edit mode context.
 * @param authorizer The authorizer used to determine if the user may edit the component - using the useAuthorizer hook.
 * @param authResult Alternatively to authorizer, you can provide an authResult directly. This is useful when authed
 * status must be determined on server side as an authorizer cannot be dynamically chosen in a server component
 * and then passed to a client component that uses this hook.
 * @returns If the component should open editMode, i.e. if the user is authorized and edit mode is enabled.
 */
export default function useEditMode({
    authorizer,
    authResult: givenAuthResult,
}: {
    authorizer: Authorizer
    authResult?: undefined
} | {
    authorizer?: undefined
    authResult: AuthResultTypeAny
}): boolean {
    const editModeCtx = useContext(EditModeContext)
    const uniqueKey = useMemo(() => uuid(), [])
    const authorizerAuthResult = useAuthorizer({
        authorizer: authorizer ? authorizer : Require.nothing()
    })
    const authResult = givenAuthResult ? givenAuthResult : authorizerAuthResult
    const { addEditableContent, removeEditableContent } = editModeCtx || {
        addEditableContent: () => { },
        removeEditableContent: () => { },
    }
    // authResult (and, when it's used, authorizer) is a freshly constructed object on every
    // render of the caller - useAuthorizer calls authorizer.auth(...) unmemoized, and several
    // callers construct their authorizer inline. Depending on the object itself would re-run
    // this effect, and re-render every subscriber of EditModeContext, on every render of every
    // component using this hook - depend on the primitive instead.
    useEffect(() => {
        if (authResult.authorized) addEditableContent(uniqueKey)
        if (!authResult.authorized) removeEditableContent(uniqueKey)
    }, [authResult.authorized, uniqueKey, addEditableContent, removeEditableContent])
    useEffect(() => () => {
        removeEditableContent(uniqueKey)
    }, [uniqueKey, removeEditableContent])
    return authResult.authorized && editModeCtx?.editMode === true
}
