'use client'
import Button from './Button'
import { htmlContentClassName } from '@/components/Cms/CmsParagraph/htmlContentClassName'
import { editorContentToMarkdown, paragraphEditorContent } from '@/lib/markdown/editorMarkdown'
import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import dynamic from 'next/dynamic'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faBold,
    faHeading,
    faItalic,
    faLink,
    faListOl,
    faListUl,
    faQuoteRight,
} from '@fortawesome/free-solid-svg-icons'
import type { Editor } from '@tiptap/react'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

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

type PropTypes = {
    label: string,
    /** The markdown it starts from. It is read once, when the input is first rendered. */
    defaultValue: string,
    /** What it starts from when the markdown is empty, such as a paragraph imported as html. */
    defaultHtml?: string,
    /** Given what makes the markdown, which is costly for a long text, so it is made when it is needed. */
    onChange: (readMarkdown: () => string) => void,
    onBlur: () => void,
}

/**
 * The rich text editor, with a toolbar over what is selected. It reads and writes markdown, so it has no
 * feature markdown cannot say. It places nothing around itself, so whatever renders it gives it its place.
 */
export default function RichTextInput({ label, defaultValue, defaultHtml, onChange, onBlur }: PropTypes) {
    const [startingContent] = useState(() => paragraphEditorContent({
        contentMd: defaultValue,
        contentHtml: defaultHtml ?? '',
    }))
    // The editor is made once, so it calls the newest of what it is given.
    const latest = useRef({ onChange, onBlur })
    useEffect(() => {
        latest.current = { onChange, onBlur }
    })

    const editor = useEditor({
        // Markdown cannot say underline.
        extensions: [StarterKit.configure({ underline: false, link: { openOnClick: false } })],
        content: startingContent,
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
                'aria-label': label,
            },
        },
        onUpdate: ({ editor: updated }) => latest.current.onChange(() => editorContentToMarkdown(updated.getJSON())),
        onBlur: () => latest.current.onBlur(),
    })

    return <>
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
    </>
}
