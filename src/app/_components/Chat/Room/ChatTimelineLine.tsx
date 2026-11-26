'use client'
import ChatFile, { ChatWholePicture, useDownload, useThumbnail } from './ChatFile'
import Button from '@/components/UI/Button'
import ProfilePicture from '@/components/User/ProfilePicture'
import { osloDateTime } from '@/lib/dates/oslo'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { memo, useEffect, useId, useState } from 'react'
import type { FetchFile } from './ChatFile'
import type { Person, TimelineLine, TimelineReaction } from '@/lib/chatSession/timeline'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { KeyboardEvent } from 'react'

const PICTURE_WIDTH = 36
/** The emojis a message is reacted to with from here. Another that someone reacted with is given from its own button. */
const EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢']

/** What is done with the lines of a timeline, each message by the id of its line. */
export type LineActions = {
    /** Sends the messages of the room that were not sent again, the one that failed first. */
    onResend: () => void,
    onDrop: (id: string) => void,
    onReply: (id: string) => void,
    onEdit: (id: string) => void,
    onRemove: (id: string) => void,
    /** Reacts with the emoji, or takes the user's own reaction with it back. */
    onReact: (id: string, emoji: string) => void,
    /** Brings a message before the reader. */
    onShow: (id: string) => void,
    /** Fetches the file or the picture of a message from the homeserver. */
    fetchFile: FetchFile,
}

type MessagePropTypes = {
    line: TimelineLine & { kind: 'MESSAGE' },
    name: string,
    image: ExpandedImage | null,
    nameOf: (person: Person) => string,
    canReact: boolean,
    /** Whether a message that was not sent keeps anything from being reacted to, edited or removed. */
    isHeldUp: boolean,
    /** Whether Tab stops at the line, which it does at one line of a timeline. The arrow keys move between them. */
    isTabStop: boolean,
    actions: LineActions,
}

/**
 * A message of a timeline: a text, or a file or a picture with what was written to go with it,
 * see ChatFile. Its text is shown as text, whatever it holds. Its line is the same
 * object until what it shows has changed, so a timeline that changes renders only the lines that
 * did, and so does a new name of someone, which renders the lines that name them. What the user
 * does with it is behind one button, so a timeline is not a wall of buttons. That button is the
 * line's one stop for the keyboard, and what it opens holds everything the line offers, also what
 * a pointer reaches on the line itself: a reaction's own button and the way to the message it
 * answers. One that was not sent says so, with its buttons named by the message they act on. Only
 * the first such of a room failed and is sent again. The later ones were held back by it, and
 * follow it when it is.
 */
export const ChatMessageLine = memo(MessageLine, (before, after) => (
    before.line === after.line && before.name === after.name && before.image === after.image
    && before.canReact === after.canReact && before.isHeldUp === after.isHeldUp && before.actions === after.actions
    && before.isTabStop === after.isTabStop
    && namesIn(before) === namesIn(after)
))

/** What a timeline says in place of what it does not show, and of what happened to the room. */
export const ChatNoteLine = memo(NoteLine)

/** What marks the button of a line's actions, which the arrow keys move between. */
export const LINE_ACTIONS = 'data-line-actions'

function MessageLine({ line, name, image, nameOf, canReact, isHeldUp, isTabStop, actions }: MessagePropTypes) {
    const { id, sending, repliesTo, reactions, file } = line
    const textId = useId()
    const [resendId, dropId, moreId, headId] = [`${textId}-resend`, `${textId}-drop`, `${textId}-more`, `${textId}-head`]
    // What the message is, for the names of its buttons: its file and its text.
    const whatId = `${textId}-file ${textId}`
    const thumbnail = useThumbnail(file, actions.fetchFile)
    const { state: downloading, download } = useDownload(file, actions.fetchFile)
    const [doing, setDoing] = useState<'NOTHING' | 'CHOOSING' | 'REMOVING'>('NOTHING')
    const mayReact = canReact && !isHeldUp

    useEffect(() => {
        // What opens under the last message is below the edge of the box.
        if (doing !== 'NOTHING') document.getElementById(lineDomId(id))?.scrollIntoView({ block: 'nearest' })
    }, [doing, id])

    const close = () => {
        setDoing('NOTHING')
        document.getElementById(moreId)?.focus()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && doing !== 'NOTHING') close()
    }

    return (
        <li
            id={lineDomId(id)}
            tabIndex={-1}
            onKeyDown={closeOnEscape}
            className={`
                flex flex-row gap-3 py-1.5 px-2 rounded-inner
                focus-visible:outline-2 focus-visible:outline-primary
                ${line.mentionsUser ? 'bg-primary/10' : ''}
            `}
        >
            <div className="shrink-0" aria-hidden="true">
                {image ? <ProfilePicture profileImage={image} width={PICTURE_WIDTH} /> : (
                    <span className="grid place-items-center size-9 rounded-full bg-base-300 font-medium">
                        {Array.from(name)[0]?.toUpperCase()}
                    </span>
                )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col">
                <div id={headId} className="flex flex-row flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{name}</span>
                    <TimeOfLine sentAt={line.sentAt} />
                    {line.isEdited && <span className="text-s text-base-content/80">redigert</span>}
                    {line.isNotEncrypted && <span className="text-s text-error">ikke kryptert</span>}
                    {line.mentionsUser && <span className="text-s font-medium text-primary">Nevner deg</span>}
                </div>
                {repliesTo === 'NOT_LOADED' && (
                    <span className="text-s text-base-content/80">Svar på en tidligere melding</span>
                )}
                {repliesTo && repliesTo !== 'NOT_LOADED' && (
                    <Button
                        variant="text"
                        color="secondary"
                        className="self-start max-w-full truncate"
                        tabIndex={-1}
                        onClick={() => actions.onShow(repliesTo.id)}
                    >
                        Svar til {nameOf(repliesTo.sender)}{repliesTo.excerpt !== null && `: ${repliesTo.excerpt}`}
                    </Button>
                )}
                {file && (
                    <div id={`${textId}-file`} className="flex flex-col">
                        <ChatFile
                            file={file}
                            thumbnail={thumbnail}
                            lineId={id}
                            fetchFile={actions.fetchFile}
                            onDownload={download}
                        />
                        <span role="status" className="
                            text-s text-base-content/80
                            empty:hidden
                        ">
                            {downloading === 'FETCHING' && 'Henter filen ...'}
                            {downloading === 'FAILED' && 'Filen ble ikke hentet.'}
                        </span>
                    </div>
                )}
                {(line.text || !file) && (
                    <p id={textId} className={`
                        m-0 whitespace-pre-wrap wrap-anywhere
                        ${sending ? 'text-base-content/80' : ''}
                    `}>
                        {line.text}
                    </p>
                )}
                {reactions.length > 0 && (
                    <ul className="m-0 p-0 py-0.5 list-none flex flex-row flex-wrap gap-1.5" aria-label="Reaksjoner">
                        {reactions.map(reaction => (
                            <li key={reaction.key}>
                                <button
                                    type="button"
                                    className={`
                                        flex flex-row items-center gap-1 rounded-full border px-2 py-0.5 text-s
                                        enabled:cursor-pointer
                                        ${reaction.own === 'NONE' ? 'border-base-300 bg-base-200' : `
                                            border-primary bg-primary/15
                                        `}
                                    `}
                                    aria-pressed={reaction.own !== 'NONE'}
                                    aria-label={`${reaction.key} ${reaction.count}: ${whoOf(reaction, nameOf)}`}
                                    title={whoOf(reaction, nameOf)}
                                    disabled={!mayReact || reaction.own === 'SENDING'}
                                    tabIndex={-1}
                                    onClick={() => actions.onReact(id, reaction.key)}
                                >
                                    <span>{reaction.key}</span>
                                    <span>{reaction.count}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
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
                                aria-labelledby={`${resendId} ${whatId}`}
                                variant="text"
                                onClick={actions.onResend}
                            >
                                Prøv igjen
                            </Button>
                        )}
                        <Button
                            id={dropId}
                            aria-labelledby={`${dropId} ${whatId}`}
                            variant="text"
                            color="red"
                            onClick={() => actions.onDrop(id)}
                        >
                            Forkast
                        </Button>
                    </div>
                )}
                {doing !== 'NOTHING' && (
                    <ActionsOfLine
                        line={line}
                        nameOf={nameOf}
                        mayReact={mayReact}
                        isHeldUp={isHeldUp}
                        isRemoving={doing === 'REMOVING'}
                        hasThumbnail={thumbnail instanceof Blob}
                        onDownload={download}
                        onAskToRemove={() => setDoing('REMOVING')}
                        onClose={close}
                        // What is chosen is done once the actions are closed, since it may move the focus.
                        onChosen={act => {
                            close()
                            act(id)
                        }}
                        actions={actions}
                    />
                )}
            </div>
            {!sending && (
                <button
                    type="button"
                    id={moreId}
                    className="
                        shrink-0 self-start grid place-items-center size-8 rounded-full border-none bg-transparent
                        text-base-content/80 cursor-pointer
                        hover:bg-base-200
                    "
                    aria-label="Handlinger"
                    // Who wrote and when is in its name, since the arrow keys read the lines by this button.
                    aria-labelledby={`${moreId} ${headId} ${whatId}`}
                    aria-expanded={doing !== 'NOTHING'}
                    tabIndex={isTabStop ? 0 : -1}
                    {...{ [LINE_ACTIONS]: true }}
                    onClick={() => setDoing(doing === 'NOTHING' ? 'CHOOSING' : 'NOTHING')}
                >
                    <FontAwesomeIcon icon={faEllipsis} />
                </button>
            )}
        </li>
    )
}

type ActionsPropTypes = Pick<MessagePropTypes, 'line' | 'nameOf' | 'isHeldUp' | 'actions'> & {
    mayReact: boolean,
    isRemoving: boolean,
    /** Whether the message is a picture that is shown, which is one that opens whole. */
    hasThumbnail: boolean,
    onDownload: () => void,
    onAskToRemove: () => void,
    onClose: () => void,
    onChosen: (act: (id: string) => void) => void,
}

/**
 * What is done with a message: its reactions with who gave them, each given and taken back, the
 * emojis it has none of yet, and answering, editing and removing it, which asks first. A file is
 * downloaded from here too, and a picture opened whole.
 */
function ActionsOfLine({
    line: { id, repliesTo, reactions, canEdit, canRemove, file },
    nameOf,
    mayReact,
    isHeldUp,
    isRemoving,
    hasThumbnail,
    onDownload,
    onAskToRemove,
    onClose,
    onChosen,
    actions,
}: ActionsPropTypes) {
    const react = (emoji: string) => onChosen(() => actions.onReact(id, emoji))

    return (
        <div className="flex flex-col items-start gap-1 py-1 text-s" role="group" aria-label="Handlinger for meldingen">
            {reactions.map(reaction => (
                <Button
                    key={reaction.key}
                    variant="text"
                    color="secondary"
                    className="max-w-full wrap-anywhere text-left"
                    aria-pressed={reaction.own !== 'NONE'}
                    disabled={!mayReact || reaction.own === 'SENDING'}
                    onClick={() => react(reaction.key)}
                >
                    {reaction.key} {whoOf(reaction, nameOf)}
                </Button>
            ))}
            {isHeldUp && (
                <span className="text-base-content/80">
                    Send eller forkast meldingen som ikke ble sendt, før du reagerer på, redigerer eller fjerner en
                    melding.
                </span>
            )}
            {isRemoving ? (
                // A key of its own, so the button that has the focus is one that is put in the page.
                <div key="removing" className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span>{canRemove ? 'Fjerne meldingen for alle?' : 'Meldingen kan ikke fjernes nå.'}</span>
                    {canRemove && (
                        <Button variant="text" color="red" onClick={() => onChosen(actions.onRemove)}>Ja, fjern</Button>
                    )}
                    <Button variant="text" autoFocus onClick={onClose}>Avbryt</Button>
                </div>
            ) : (
                <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1">
                    <Button variant="text" autoFocus onClick={() => onChosen(actions.onReply)}>Svar</Button>
                    {canEdit && <Button variant="text" onClick={() => onChosen(actions.onEdit)}>Rediger</Button>}
                    {file && hasThumbnail && (
                        // The actions stay open under the picture, so the focus is back on this button when it closes.
                        <ChatWholePicture
                            popUpKey={`chat-picture-of-actions-${id}`}
                            file={file}
                            fetchFile={actions.fetchFile}
                            onDownload={onDownload}
                        >
                            {open => <Button variant="text" onClick={open}>Vis hele bildet</Button>}
                        </ChatWholePicture>
                    )}
                    {file?.media && <Button variant="text" onClick={() => onChosen(onDownload)}>Last ned</Button>}
                    {canRemove && <Button variant="text" color="red" onClick={onAskToRemove}>Fjern</Button>}
                    {repliesTo && repliesTo !== 'NOT_LOADED' && (
                        <Button variant="text" onClick={() => onChosen(() => actions.onShow(repliesTo.id))}>
                            Gå til meldingen den svarer på
                        </Button>
                    )}
                    {mayReact && EMOJIS.filter(emoji => reactions.every(({ key }) => key !== emoji)).map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            className="
                                grid place-items-center size-8 rounded-full border-none bg-base-200 cursor-pointer
                                hover:bg-base-300
                            "
                            aria-label={`Reager med ${emoji}`}
                            onClick={() => react(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

/** The id of a message's element, which the answer to it leads to. */
export function lineDomId(id: string): string {
    return `chat-line-${id}`
}

function NoteLine({ wording, sentAt }: { wording: string, sentAt: number | null }) {
    return (
        <li className="flex flex-row flex-wrap items-baseline gap-x-2 py-1 px-2 text-s text-base-content/80">
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

/** The names a line shows besides its sender's. */
function namesIn({ line: { repliesTo, reactions }, nameOf }: MessagePropTypes): string {
    const answered = repliesTo && repliesTo !== 'NOT_LOADED' ? [repliesTo.sender] : []
    return [...answered, ...reactions.flatMap(({ by }) => by)].map(nameOf).join('\n')
}

/** Who reacted with an emoji: those the timeline names, and how many more there are. */
function whoOf({ by, count }: TimelineReaction, nameOf: (person: Person) => string): string {
    const more = count - by.length
    return new Intl.ListFormat('nb').format([...by.map(nameOf), ...(more > 0 ? [`${more} til`] : [])])
}
