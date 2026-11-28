'use client'
import { configureAction } from '@/services/configureAction'
import useSiteRouter from '@/hooks/useSiteRouter'
import RichTextInput from '@/components/UI/RichTextInput'
import SaveStatusIcon from '@/components/UI/SaveStatusIcon'
import { useEffect, useRef, useState } from 'react'
import type { SaveStatus } from '@/components/UI/SaveStatusIcon'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'

const autosaveDelayMs = 1000

type PropTypes = {
    cmsParagraph: CmsParagraph
    className?: string
    updateCmsParagraphAction: UpdateCmsParagraphAction
}

/**
 * The editor for a paragraph, which saves itself a moment after the last change. It does not check whether the
 * viewer may edit - render it only for someone who may. `CmsParagraphEditor` puts it behind edit
 * mode; a page whose whole purpose is editing can render it directly.
 */
export default function CmsParagraphEditorForm({ cmsParagraph, className, updateCmsParagraphAction }: PropTypes) {
    const { refresh } = useSiteRouter()
    const action = configureAction(updateCmsParagraphAction, { params: { paragraphId: cmsParagraph.id } })
    const [status, setStatus] = useState<SaveStatus>('untouched')
    // Why the last save was refused, in the words the server answered with.
    const [refusal, setRefusal] = useState('')
    // What makes the markdown waiting to be saved, and the timer that will save it.
    const pending = useRef<{ readMarkdown: () => string, timer: ReturnType<typeof setTimeout> } | null>(null)
    // Counts the saves, so an answer to an older one does not speak for a newer.
    const latestSave = useRef(0)

    const save = async (markdown: string) => {
        const thisSave = ++latestSave.current
        setStatus('saving')
        const result = await action({ data: { markdown } })
        if (thisSave !== latestSave.current) return
        setStatus(result.success ? 'saved' : 'failed')
        if (!result.success) setRefusal(result.error?.[0]?.message ?? 'Kunne ikke lagre')
        // The page around the editor shows the text too, once edit mode is left.
        if (result.success) refresh()
    }
    const saveRef = useRef(save)
    useEffect(() => {
        saveRef.current = save
    })

    const savePendingNow = () => {
        if (!pending.current) return
        clearTimeout(pending.current.timer)
        const { readMarkdown } = pending.current
        pending.current = null
        void saveRef.current(readMarkdown())
    }
    // Leaving edit mode takes the editor away, which must not take the last change with it.
    useEffect(() => savePendingNow, [])

    const change = (readMarkdown: () => string) => {
        if (pending.current) clearTimeout(pending.current.timer)
        pending.current = { readMarkdown, timer: setTimeout(savePendingNow, autosaveDelayMs) }
        setStatus('unsaved')
    }

    return (
        <div className={`
            relative
            ${className ?? ''}
        `}>
            <RichTextInput
                label="Innhold"
                defaultValue={cmsParagraph.contentMd}
                defaultHtml={cmsParagraph.contentHtml}
                onChange={change}
                onBlur={savePendingNow}
            />
            <SaveStatusIcon status={status} />
            {status === 'failed' && <div role="alert" className="mt-4 text-s text-error">{refusal}</div>}
        </div>
    )
}
