'use client'
import useEditMode from '@/hooks/useEditMode'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    onlyInEditMode: boolean,
    capabilities: CapabilitiesJsObject<'canEdit'>,
}

export default function EmptyArticle({ onlyInEditMode, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })

    if (onlyInEditMode && !editable) return null
    return <i className="flex h-[2em]">Denne artikkelen er tom</i>
}
