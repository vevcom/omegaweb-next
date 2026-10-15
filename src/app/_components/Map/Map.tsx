'use client'

import Button from '@/components/UI/Button'
import { useEffect, useRef, useState } from 'react'

export type MapProps = {
    height: string,
}

type PropTypes = MapProps & {
    src: string,
    href?: string,
    title: string,
    invertColors?: boolean,
}

export default function Map({ height, src, href, title, invertColors = false }: PropTypes) {
    const [active, setActive] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (active) iframeRef.current?.focus()
    }, [active])

    return <div className="flex flex-col items-center gap-2" onPointerLeave={() => setActive(false)}>
        <div
            className={`relative w-4/5 rounded-round overflow-hidden ${invertColors ? 'invert hue-rotate-180' : ''}`}
            style={{ height }}
        >
            <iframe
                ref={iframeRef}
                title={title}
                src={src}
                className="size-full border-none rounded-round bg-white"
                tabIndex={active ? 0 : -1}
                loading="lazy"
            />
            {!active && <button
                type="button"
                className="absolute inset-0 z-1 p-0 border-none bg-transparent cursor-pointer"
                onClick={() => setActive(true)}
                aria-label="Aktiver kartet for interaksjon"
            />}
        </div>
        {href && <a href={href} target="_blank" rel="noopener noreferrer">Åpne i {title}</a>}
        {active && <Button type="button" color="secondary" onClick={() => setActive(false)}>
            Deaktiver kartet
        </Button>}
    </div>
}
