'use client'
import Button from '@/components/UI/Button'
import Textarea from '@/components/UI/Textarea'
import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'

type PropTypes = {
    roomName: string,
    onSend: (text: string) => void,
}

/**
 * Where a message to a room is written. Enter sends it and Shift with Enter breaks the line. It
 * has the focus when the room is opened.
 */
export default function ChatComposer({ roomName, onSend }: PropTypes) {
    const [text, setText] = useState('')
    const fieldId = useId()
    const isEmpty = text.trim() === ''

    const send = () => {
        if (isEmpty) return
        onSend(text)
        setText('')
        // The button is no longer to be pressed once the field is empty, and the next message is written here.
        document.getElementById(fieldId)?.focus()
    }

    const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter also picks a word of an input method, which is no message to send.
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
        event.preventDefault()
        send()
    }

    return (
        <form
            className="flex flex-row items-end gap-2"
            onSubmit={event => {
                event.preventDefault()
                send()
            }}
        >
            <Textarea
                id={fieldId}
                name="message"
                label={`Melding til ${roomName}`}
                rows={1}
                value={text}
                onChange={event => setText(event.target.value)}
                onKeyDown={sendOnEnter}
                autoFocus
            />
            <Button type="submit" disabled={isEmpty}>Send</Button>
        </form>
    )
}
