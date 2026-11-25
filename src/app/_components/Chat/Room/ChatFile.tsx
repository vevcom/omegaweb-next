'use client'
import { wordingOfSize } from './timelineWording'
import Button from '@/components/UI/Button'
import PopUp from '@/components/PopUp/PopUp'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperclip } from '@fortawesome/free-solid-svg-icons'
import { useCallback, useEffect, useState } from 'react'
import type { Media } from '@/lib/chatSession/media'
import type { TimelineFile, WatchedRoomTimeline } from '@/lib/chatSession/timeline'
import type { ImgHTMLAttributes, ReactNode } from 'react'

export type FetchFile = WatchedRoomTimeline['fetchFile']

/** How long the address of a file that is saved is kept, which is until the browser has surely taken it. */
const SAVED_ADDRESS_KEPT_MS = 60_000

type PropTypes = {
    file: TimelineFile,
    /** The small picture of it, while it is fetched, or none: it is no picture, or there is none of it that is shown. */
    thumbnail: Blob | 'FETCHING' | 'NONE',
    /** The line's id, which names the pop-up of the picture. */
    lineId: string,
    fetchFile: FetchFile,
    onDownload: () => void,
}

/**
 * The file or the picture of a message. A picture is the small one the homeserver made of it, in
 * the box kept for it, and opens whole. Anything else is its name, which downloads it: also a
 * picture the homeserver made no small one of, such as an SVG, which is a document and is never
 * shown. An encrypted picture the homeserver cannot read, so the browser fetches and unlocks it
 * and shows it where it is a picture by its own bytes, see fetchMedia. The line's actions hold the
 * same, so neither button here is a stop for the keyboard.
 */
export default function ChatFile({ file, thumbnail, lineId, fetchFile, onDownload }: PropTypes) {
    const { name, size, media, box } = file

    if (thumbnail === 'NONE') {
        return (
            <span className="flex flex-row flex-wrap items-baseline gap-x-2">
                <Button variant="text" className="max-w-full truncate" tabIndex={-1} disabled={!media} onClick={onDownload}>
                    <FontAwesomeIcon icon={faPaperclip} className="mr-1.5" />
                    <span className="sr-only">Last ned </span>
                    {name}
                </Button>
                {size !== null && <span className="text-s text-base-content/80">{wordingOfSize(size)}</span>}
                {!media && <span className="text-s text-base-content/80">Kan ikke hentes her.</span>}
            </span>
        )
    }
    return (
        <ChatWholePicture popUpKey={`chat-picture-${lineId}`} file={file} fetchFile={fetchFile} onDownload={onDownload}>
            {open => (
                <button
                    type="button"
                    className="
                        relative self-start max-w-full my-1 p-0 border-none rounded-inner overflow-hidden bg-base-200
                        enabled:cursor-zoom-in
                    "
                    // The shape and not the height, so a line that is narrower than the box keeps its shape.
                    style={{ width: box.width, aspectRatio: `${box.width} / ${box.height}` }}
                    aria-label={thumbnail === 'FETCHING' ? `Henter bildet ${name}` : `Vis hele bildet ${name}`}
                    disabled={thumbnail === 'FETCHING'}
                    tabIndex={-1}
                    onClick={open}
                >
                    {thumbnail !== 'FETCHING' && (
                        <ChatPicture picture={thumbnail} alt="" className="absolute inset-0 size-full object-contain" />
                    )}
                </button>
            )}
        </ChatWholePicture>
    )
}

type WholePropTypes = Pick<PropTypes, 'file' | 'fetchFile' | 'onDownload'> & {
    popUpKey: string,
    /** The button that opens the picture. */
    children: (open: () => void) => ReactNode,
}

/** A pop-up that shows a picture whole, fetched when it is opened and let go of when it is closed. */
export function ChatWholePicture({ popUpKey, file, fetchFile, onDownload, children }: WholePropTypes) {
    return (
        <PopUp popUpKey={popUpKey} customShowButton={children}>
            <WholePicture file={file} fetchFile={fetchFile} onDownload={onDownload} />
        </PopUp>
    )
}

function WholePicture({ file: { name, media }, fetchFile, onDownload }: Omit<WholePropTypes, 'popUpKey' | 'children'>) {
    const fetched = useFetched(media, 'PICTURE', fetchFile)

    return (
        // A pop-up is as narrow as what it holds lets it be, which for a picture alone is nothing.
        <figure className="
            m-0 flex flex-col items-center gap-3 w-[min(80vw,60rem)]
            max-mobile:w-auto
        ">
            <p role="status" className="
                m-0
                empty:hidden
            ">
                {fetched === 'FETCHING' && 'Henter bildet ...'}
                {fetched === 'NONE' && 'Bildet kan ikke vises her. Last det ned for å se det.'}
            </p>
            {fetched instanceof Blob && (
                <ChatPicture picture={fetched} alt={name} className="max-w-full max-h-[70vh] object-contain" />
            )}
            <figcaption className="flex flex-row flex-wrap items-baseline justify-center gap-x-4">
                <span className="wrap-anywhere">{name}</span>
                <Button variant="text" onClick={onDownload}>Last ned</Button>
            </figcaption>
        </figure>
    )
}

/** The small picture of a file that was sent as a picture, see the thumbnail of ChatFile. */
export function useThumbnail(file: TimelineFile | null, fetchFile: FetchFile): Blob | 'FETCHING' | 'NONE' {
    return useFetched(file?.small ?? null, 'THUMBNAIL', fetchFile)
}

/**
 * Fetches a file and saves it under its name, and says how that stands. What is saved is bytes of
 * no kind, see fetchMedia, so the browser saves it whatever it is and whatever it is called.
 */
export function useDownload(file: TimelineFile | null, fetchFile: FetchFile) {
    const [state, setState] = useState<'IDLE' | 'FETCHING' | 'FAILED'>('IDLE')
    const isFetching = state === 'FETCHING'
    const download = useCallback(() => {
        if (!file?.media || isFetching) return
        setState('FETCHING')
        fetchFile(file.media, 'DOWNLOAD').then(fetched => {
            const address = URL.createObjectURL(fetched)
            Object.assign(document.createElement('a'), { href: address, download: file.name }).click()
            setTimeout(() => URL.revokeObjectURL(address), SAVED_ADDRESS_KEPT_MS)
            setState('IDLE')
        }, () => setState('FAILED'))
    }, [file, fetchFile, isFetching])
    return { state, download }
}

/**
 * A picture the browser holds, shown by an address of the page's own, since the homeserver gives
 * no file to an address in a page. The address is let go of when the picture is no longer shown:
 * the browser keeps what it names for as long as it lives.
 */
export function ChatPicture({ picture, ...props }: { picture: Blob } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
    const show = useCallback((element: HTMLImageElement | null) => {
        if (!element) return undefined
        const address = URL.createObjectURL(picture)
        element.src = address
        return () => URL.revokeObjectURL(address)
    }, [picture])

    return <img ref={show} alt="" {...props} />
}

function useFetched(
    media: TimelineFile['media'],
    as: 'THUMBNAIL' | 'PICTURE',
    fetchFile: FetchFile,
): Blob | 'FETCHING' | 'NONE' {
    const [fetched, setFetched] = useState<{ of: string, picture: Blob | null } | null>(null)
    // A line that changes holds a new object for the same file, which is not to be fetched again.
    const wanted = media && JSON.stringify(media)
    useEffect(() => {
        if (wanted === null) return undefined
        const stop = new AbortController()
        const keep = (picture: Blob | null) => {
            if (!stop.signal.aborted) setFetched({ of: wanted, picture })
        }
        fetchFile(JSON.parse(wanted) as Media, as, stop.signal).then(keep, () => keep(null))
        return () => stop.abort()
    }, [wanted, as, fetchFile])
    if (wanted === null) return 'NONE'
    return fetched?.of === wanted ? fetched.picture ?? 'NONE' : 'FETCHING'
}
