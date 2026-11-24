'use client'
import Button from '@/components/UI/Button'
import ProfilePicture from '@/components/User/ProfilePicture'
import { osloDateTime } from '@/lib/dates/oslo'
import { memo, useId } from 'react'
import type { ExpandedImage } from '@/services/images/subservice/types'

const PICTURE_WIDTH = 36

type MessagePropTypes = {
    id: string,
    name: string,
    image: ExpandedImage | null,
    sentAt: number | null,
    text: string,
    isReply: boolean,
    sending: 'SENDING' | 'FAILED' | 'HELD' | null,
    /** Sends the messages of the room that were not sent again, this one first. */
    onResend: () => void,
    onDrop: (id: string) => void,
}

/**
 * A text message of a timeline. Its text is shown as text, whatever it holds. It takes what it
 * shows as plain values, so a timeline that changes renders only the lines that did. One that was
 * not sent says so, with its buttons named by the message they act on. Only the first such of a
 * room failed and is sent again. The later ones were held back by it, and follow it when it is.
 */
export const ChatMessageLine = memo(MessageLine)

/** What a timeline says in place of what it does not show, and of what happened to the room. */
export const ChatNoteLine = memo(NoteLine)

function MessageLine({ id, name, image, sentAt, text, isReply, sending, onResend, onDrop }: MessagePropTypes) {
    const textId = useId()
    const [resendId, dropId] = [`${textId}-resend`, `${textId}-drop`]

    return (
        <li className="flex flex-row gap-3 py-1.5">
            <div className="shrink-0" aria-hidden="true">
                {image ? <ProfilePicture profileImage={image} width={PICTURE_WIDTH} /> : (
                    <span className="grid place-items-center size-9 rounded-full bg-base-300 font-medium">
                        {Array.from(name)[0]?.toUpperCase()}
                    </span>
                )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex flex-row flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{name}</span>
                    <TimeOfLine sentAt={sentAt} />
                </div>
                {isReply && <span className="text-s text-base-content/80">Svar på en tidligere melding</span>}
                <p id={textId} className={`
                    m-0 whitespace-pre-wrap wrap-anywhere
                    ${sending ? 'text-base-content/80' : ''}
                `}>
                    {text}
                </p>
                {sending === 'SENDING' && <span className="text-s text-base-content/80">Sender ...</span>}
                {(sending === 'FAILED' || sending === 'HELD') && (
                    <div className="flex flex-row flex-wrap items-baseline gap-x-3 text-s">
                        <span className="text-error">
                            {sending === 'FAILED'
                                ? 'Meldingen ble ikke sendt.'
                                : 'Sendes ikke før meldingen over er sendt eller forkastet.'}
                        </span>
                        {sending === 'FAILED' && (
                            <Button
                                id={resendId}
                                aria-labelledby={`${resendId} ${textId}`}
                                variant="text"
                                onClick={onResend}
                            >
                                Prøv igjen
                            </Button>
                        )}
                        <Button
                            id={dropId}
                            aria-labelledby={`${dropId} ${textId}`}
                            variant="text"
                            color="red"
                            onClick={() => onDrop(id)}
                        >
                            Forkast
                        </Button>
                    </div>
                )}
            </div>
        </li>
    )
}

function NoteLine({ wording, sentAt }: { wording: string, sentAt: number | null }) {
    return (
        <li className="flex flex-row flex-wrap items-baseline gap-x-2 py-1 text-s text-base-content/80">
            <span className="wrap-anywhere">{wording}</span>
            <TimeOfLine sentAt={sentAt} />
        </li>
    )
}

function TimeOfLine({ sentAt }: { sentAt: number | null }) {
    if (sentAt === null) return null
    const at = osloDateTime(new Date(sentAt))
    return <time dateTime={at.toISO() ?? undefined} className="text-s text-base-content/80">{at.toFormat('HH:mm')}</time>
}
