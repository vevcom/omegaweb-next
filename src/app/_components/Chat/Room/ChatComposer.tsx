'use client'
import Button from '@/components/UI/Button'
import { DropdownPanel, dropdownOptionId } from '@/components/UI/Dropdown'
import Textarea from '@/components/UI/Textarea'
import { ROOM_MENTION, mentionBefore, mentionsOf, stillMentioned, withMention } from '@/lib/chatSession/mentions'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { DropdownOption } from '@/components/UI/Dropdown'
import type { Mentions, Person } from '@/lib/chatSession/timeline'
import type { KeyboardEvent } from 'react'

const SUGGESTED_AT_MOST = 6
const NOBODY: readonly Person[] = []

type Draft = { text: string, picked: Person[] }

type PropTypes = {
    roomName: string,
    /** The id the field is to have, for one who moves the focus to it. */
    fieldId?: string,
    /**
     * What is written is an answer to a message, or the new text of the message with this id,
     * which the field then holds, with those the message mentions by the names they are shown by.
     */
    about?: { kind: 'REPLY', name: string, text: string }
        | { kind: 'EDIT', id: string, text: string, mentioned: readonly Person[] }
        | null,
    onCancelAbout?: () => void,
    /** Those of the room that may be mentioned, by the names they are shown by. */
    mentionable?: readonly Person[],
    canMentionRoom?: boolean,
    /** Called when the user starts on a mention, to bring those of the room. */
    onMentioning?: () => void,
    /** Gives false when what was written was not taken, and is then left in the field. */
    onSend: (text: string, mentions: Mentions) => boolean | void,
}

/**
 * Where a message to a room is written. Enter sends it and Shift with Enter breaks the line. It
 * has the focus when the room is opened. An at sign and the beginning of a name suggest those of
 * the room, and whom a text mentions is mentionsOf's to say. While a message is given a new text
 * the field holds that text, and what was being written is kept and is back in the field when
 * that is over, so starting on an edit throws nothing away.
 */
export default function ChatComposer({
    roomName,
    fieldId: givenFieldId,
    about,
    onCancelAbout,
    mentionable = NOBODY,
    canMentionRoom = false,
    onMentioning,
    onSend,
}: PropTypes) {
    const ownFieldId = useId()
    const fieldId = givenFieldId ?? ownFieldId
    const editing = about?.kind === 'EDIT' ? about : null
    const [text, setText] = useState('')
    const [caret, setCaret] = useState(0)
    const [picked, setPicked] = useState<Person[]>([])
    const [edited, setEdited] = useState<{ id: string, draft: Draft } | null>(null)
    const [active, setActive] = useState(0)
    const [dismissedAt, setDismissedAt] = useState<number | null>(null)
    const caretToPlace = useRef<number | null>(null)
    const suggestionsId = useId()
    const isEmpty = text.trim() === ''

    // The message that is edited is another than the field holds the text of: its text takes the
    // place of what was being written, which is kept, or what was kept is back.
    if ((editing?.id ?? null) !== (edited?.id ?? null)) {
        const draft = edited?.draft ?? { text, picked }
        setEdited(editing ? { id: editing.id, draft } : null)
        setText(editing ? editing.text : draft.text)
        // Whom the message mentioned is mentioned by its new text while they stand in it, as one who is picked.
        setPicked(editing ? [...editing.mentioned] : draft.picked)
        setCaret((editing ?? draft).text.length)
    }

    const mention = mentionBefore(text, caret)
    const suggested: DropdownOption<string>[] = mention && mention.start !== dismissedAt ? [
        ...(canMentionRoom ? [{ value: ROOM_MENTION, label: `Alle i rommet (${ROOM_MENTION})` }] : []),
        ...mentionable.map(person => ({ value: person.id, label: person.name })),
    ].filter(({ label }) => label.toLowerCase().includes(mention.query.toLowerCase())).slice(0, SUGGESTED_AT_MOST) : []
    const activeNow = Math.min(active, suggested.length - 1)
    const isMentioning = mention !== null

    useEffect(() => {
        if (isMentioning) onMentioning?.()
    }, [isMentioning, onMentioning])

    useLayoutEffect(() => {
        const field = document.getElementById(fieldId)
        if (caretToPlace.current === null || !(field instanceof HTMLTextAreaElement)) return
        field.focus()
        field.setSelectionRange(caretToPlace.current, caretToPlace.current)
        caretToPlace.current = null
    }, [fieldId, text])

    const editedId = edited?.id
    useLayoutEffect(() => {
        const field = document.getElementById(fieldId)
        if (!(field instanceof HTMLTextAreaElement)) return
        field.focus()
        field.setSelectionRange(field.value.length, field.value.length)
    }, [fieldId, editedId])

    const pick = ({ value }: DropdownOption<string>) => {
        const person = mentionable.find(({ id }) => id === value)
        if (!mention || (!person && value !== ROOM_MENTION)) return
        const placed = withMention(text, mention.start, caret, person ? `@${person.name}` : ROOM_MENTION)
        caretToPlace.current = placed.caret
        setText(placed.text)
        setCaret(placed.caret)
        if (person) setPicked([...picked, person])
    }

    const send = () => {
        if (isEmpty || onSend(text, mentionsOf(text, picked)) === false || editing) return
        setText('')
        setPicked([])
        // The button is no longer to be pressed once the field is empty, and the next message is written here.
        document.getElementById(fieldId)?.focus()
    }

    const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter also picks a word of an input method, which is no message to send.
        if (event.nativeEvent.isComposing) return
        const isEnter = event.key === 'Enter' && !event.shiftKey
        // Shift with Tab leaves the field, as it does everywhere.
        const isTab = event.key === 'Tab' && !event.shiftKey
        if (suggested.length > 0 && (['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key) || isTab) || isEnter) {
            event.preventDefault()
        }
        if (suggested.length === 0) {
            if (isEnter) send()
            if (event.key === 'Escape' && about) onCancelAbout?.()
        } else if (event.key === 'ArrowDown') setActive((activeNow + 1) % suggested.length)
        else if (event.key === 'ArrowUp') setActive((activeNow - 1 + suggested.length) % suggested.length)
        else if (isEnter || isTab) pick(suggested[activeNow])
        else if (event.key === 'Escape') setDismissedAt(mention?.start ?? null)
    }

    return (
        <form
            className="flex flex-col gap-1"
            onSubmit={event => {
                event.preventDefault()
                send()
            }}
        >
            {about && (
                <div className="flex flex-row items-baseline gap-x-3 text-s">
                    <span className="min-w-0 truncate text-base-content/80">
                        {about.kind === 'EDIT' ? 'Du redigerer en melding.' : `Svarer ${about.name}: ${about.text}`}
                    </span>
                    <Button type="button" variant="text" onClick={onCancelAbout}>Avbryt</Button>
                </div>
            )}
            <div className="flex flex-row items-end gap-2">
                <div className="relative min-w-0 flex-1">
                    <Textarea
                        id={fieldId}
                        name="message"
                        label={`Melding til ${roomName}`}
                        rows={1}
                        value={text}
                        onChange={({ target }) => {
                            setText(target.value)
                            setCaret(target.selectionStart)
                            setActive(0)
                            // One whose mention is deleted is forgotten, so their name written later mentions nobody.
                            setPicked(stillMentioned(target.value, picked))
                            // The suggestions that were closed are those of that mention, and not of the next one.
                            if (!mentionBefore(target.value, target.selectionStart)) setDismissedAt(null)
                        }}
                        onSelect={event => setCaret(event.currentTarget.selectionStart)}
                        onKeyDown={onKey}
                        aria-autocomplete="list"
                        aria-controls={suggested.length > 0 ? suggestionsId : undefined}
                        aria-activedescendant={suggested.length > 0
                            ? dropdownOptionId(suggestionsId, activeNow)
                            : undefined}
                        autoFocus
                    />
                    {suggested.length > 0 && (
                        <DropdownPanel
                            id={suggestionsId}
                            placement="above"
                            options={suggested}
                            value={undefined}
                            activeIndex={activeNow}
                            onSelect={pick}
                            onActivate={setActive}
                        />
                    )}
                </div>
                <Button type="submit" disabled={isEmpty}>{editing ? 'Lagre' : 'Send'}</Button>
            </div>
        </form>
    )
}
