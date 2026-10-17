'use client'
import 'easymde/dist/easymde.min.css'
import './CustomEditorClasses.scss'
import styles from './CmsParagraphEditor.module.scss'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { Options as EditorOptions } from 'easymde'

// Needed because SimpleMDE is not SSR compatible as it access navigator object
const DynamicSimpleMDEditor = dynamic(
    () => import('react-simplemde-editor'),
    {
        ssr: false,
        loading: () => <p className={styles.loader}>Laster...</p>
    }
)

/**
 * The preview injects the rendered markdown as html, and the editor only sanitizes it when told to.
 * Without this a script saved in a paragraph (a member's own bio, say) would run in the session of
 * whoever opens the editor on it. Kept outside the component: a new options object remounts the editor.
 */
const editorOptions: EditorOptions = {
    renderingConfig: { sanitizerFunction: sanitizeHtml },
    // Both load from third-party CDNs, which the content security policy refuses. The toolbar that
    // uses the icons is hidden (CustomEditorClasses.scss), and the dictionary is English.
    autoDownloadFontAwesome: false,
    spellChecker: false,
}

type PropTypes = {
    cmsParagraph: CmsParagraph
    className?: string
    updateCmsParagraphAction: UpdateCmsParagraphAction
}

/**
 * The markdown editor for a paragraph and the button that saves it. It does not check whether the
 * viewer may edit - render it only for someone who may. `CmsParagraphEditor` puts it behind edit
 * mode; a page whose whole purpose is editing can render it directly.
 */
export default function CmsParagraphEditorForm({ cmsParagraph, className, updateCmsParagraphAction }: PropTypes) {
    const { refresh } = useRouter()
    const [content, setContent] = useState(cmsParagraph.contentMd)

    const handleContentChange = (value: string) => {
        setContent(value)
    }

    const action = configureAction(updateCmsParagraphAction, { params: { paragraphId: cmsParagraph.id } })

    return (
        <div className={`${styles.form} ${className ?? ''}`}>
            <DynamicSimpleMDEditor
                className={styles.editor}
                value={content}
                onChange={handleContentChange}
                options={editorOptions}
            />
            <Form
                action={action.bind(null, { data: { markdown: content } })}
                submitText="Oppdater"
                successCallback={() => {
                    refresh()
                }}
            />
        </div>
    )
}
