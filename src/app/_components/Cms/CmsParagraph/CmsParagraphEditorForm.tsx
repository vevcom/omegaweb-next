'use client'
import { htmlContentClassName } from './htmlContentClassName'
import { configureAction } from '@/services/configureAction'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import useSiteRouter from '@/hooks/useSiteRouter'
import Button from '@/components/UI/Button'
import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import dynamic from 'next/dynamic'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faBold,
    faCheck,
    faHeading,
    faItalic,
    faLink,
    faListOl,
    faListUl,
    faPen,
    faQuoteRight,
    faSpinner,
    faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import type { Editor } from '@tiptap/react'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'

// Loaded in the browser alone: on the server the menu brings in a second copy of ProseMirror's table
// module, which refuses to be registered twice.
const BubbleMenu = dynamic(() => import('@tiptap/react/menus').then(menus => menus.BubbleMenu), { ssr: false })

type Tool = {
    label: string,
    icon: IconDefinition,
    isActive: (editor: Editor) => boolean,
    run: (editor: Editor) => void,
}

const tools: Tool[] = [
    {
        label: 'Fet',
        icon: faBold,
        isActive: editor => editor.isActive('bold'),
        run: editor => editor.chain().focus().toggleBold().run(),
    },
    {
        label: 'Kursiv',
        icon: faItalic,
        isActive: editor => editor.isActive('italic'),
        run: editor => editor.chain().focus().toggleItalic().run(),
    },
    {
        label: 'Overskrift',
        icon: faHeading,
        isActive: editor => editor.isActive('heading', { level: 2 }),
        run: editor => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
        label: 'Punktliste',
        icon: faListUl,
        isActive: editor => editor.isActive('bulletList'),
        run: editor => editor.chain().focus().toggleBulletList().run(),
    },
    {
        label: 'Nummerert liste',
        icon: faListOl,
        isActive: editor => editor.isActive('orderedList'),
        run: editor => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        label: 'Sitat',
        icon: faQuoteRight,
        isActive: editor => editor.isActive('blockquote'),
        run: editor => editor.chain().focus().toggleBlockquote().run(),
    },
    {
        label: 'Lenke',
        icon: faLink,
        isActive: editor => editor.isActive('link'),
        run: editor => {
            if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run()
                return
            }
            // ponytail: the browser's own prompt asks for the address. Give it a pop-up of its own
            // when the editor gets its other dialogs, for images and the carousel.
            const href = window.prompt('Adressen lenken går til')
            if (href) editor.chain().focus().setLink({ href }).run()
        },
    },
]

const autosaveDelayMs = 1000

const statuses = {
    untouched: null,
    saved: { label: 'Lagret', icon: faCheck, className: 'text-success' },
    unsaved: { label: 'Ikke lagret', icon: faPen, className: 'text-base-content/60' },
    saving: { label: 'Lagrer...', icon: faSpinner, className: 'text-base-content/60' },
    failed: { label: 'Kunne ikke lagre', icon: faTriangleExclamation, className: 'text-error' },
}

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
    const [status, setStatus] = useState<keyof typeof statuses>('untouched')
    // The change waiting to be saved, with the timer that will save it.
    const pending = useRef<{ html: string, timer: ReturnType<typeof setTimeout> } | null>(null)
    // Counts the saves, so an answer to an older one does not speak for a newer.
    const latestSave = useRef(0)

    const save = async (html: string) => {
        const thisSave = ++latestSave.current
        setStatus('saving')
        const result = await action({ data: { html } })
        if (thisSave !== latestSave.current) return
        setStatus(result.success ? 'saved' : 'failed')
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
        const { html } = pending.current
        pending.current = null
        void saveRef.current(html)
    }
    // Leaving edit mode takes the editor away, which must not take the last change with it.
    useEffect(() => savePendingNow, [])

    const editor = useEditor({
        // The sanitizer drops <u>, so underlining would be lost on save.
        extensions: [StarterKit.configure({ underline: false, link: { openOnClick: false } })],
        // Older rows never passed the sanitizer, so the html is cleaned before the editor parses it.
        content: sanitizeHtml(cmsParagraph.contentHtml),
        // The first render is on the server, where there is no document to mount the editor in.
        immediatelyRender: false,
        // The toolbar shows which marks the selection has, so it follows every change of it.
        shouldRerenderOnTransaction: true,
        editorProps: {
            attributes: {
                // ProseMirror adds the classes one by one and takes no line breaks between them.
                class: `
                    ${htmlContentClassName}
                    min-h-8 rounded-inner cursor-text bg-base-content/10 ring-8 ring-base-content/10 outline-primary
                    outline-offset-8
                    focus:outline-1
                `.split(/\s+/).filter(Boolean).join(' '),
                'aria-label': 'Innhold',
            },
        },
        onUpdate: ({ editor: updated }) => {
            if (pending.current) clearTimeout(pending.current.timer)
            pending.current = {
                html: updated.isEmpty ? '' : updated.getHTML(),
                timer: setTimeout(savePendingNow, autosaveDelayMs),
            }
            setStatus('unsaved')
        },
        onBlur: savePendingNow,
    })

    return (
        <div className={`
            relative
            ${className ?? ''}
        `}>
            {editor && <BubbleMenu editor={editor}>
                <div role="toolbar" aria-label="Formatering" className="
                    flex gap-1 p-1 rounded-round bg-base-300 border border-base-content/20 shadow-md
                ">
                    {tools.map(tool => (
                        <Button
                            key={tool.label}
                            variant="icon"
                            color="neutral"
                            type="button"
                            title={tool.label}
                            aria-label={tool.label}
                            aria-pressed={tool.isActive(editor)}
                            onClick={() => tool.run(editor)}
                        >
                            <FontAwesomeIcon icon={tool.icon} />
                        </Button>
                    ))}
                </div>
            </BubbleMenu>}
            <EditorContent editor={editor} />
            <span
                role="status"
                data-save-status
                title={statuses[status]?.label}
                aria-label={statuses[status]?.label}
                className={`
                    absolute -top-[10px] -right-[10px] z-2 size-8 grid place-items-center rounded-inner cursor-default
                    ${statuses[status] ? `
                        bg-base-200
                        ${statuses[status].className}
                    ` : ''}
                `}
            >
                {statuses[status] && <FontAwesomeIcon icon={statuses[status].icon} spin={status === 'saving'} />}
            </span>
        </div>
    )
}
