import type { EventTag } from '@/prisma-generated-pn-types'

type PropTypes = {
    eventTag: EventTag
}

export default function EventTag({ eventTag }: PropTypes) {
    // if background color is too dark color of text should be white
    const textColor = (eventTag.colorR * 0.299 + eventTag.colorG * 0.587 + eventTag.colorB * 0.114) > 100 ? 'black' : 'white'
    return (
        <div className="group/tag relative flex items-center w-[100px] h-[50px] p-[.5em] rounded-[50px] hover:cursor-pointer" style={{
            color: textColor,
            backgroundColor: `rgb(${eventTag.colorR}, ${eventTag.colorG}, ${eventTag.colorB})`
        }}>
            <p className="w-full text-center overflow-hidden">{eventTag.name}</p>
            <p className="hidden group-hover/tag:block absolute bottom-0 left-1/2 [transform:translate(-50%,calc(100%_+_10px))] p-[1em] rounded-[1em] bg-surface-hover text-text before:content-[''] before:absolute before:top-0 before:left-1/2 before:[transform:translate(-50%,-100%)] before:border-x-[10px] before:border-x-transparent before:border-b-[10px] before:border-b-surface-hover before:border-t-0">
                {eventTag.description}
            </p>
        </div>
    )
}
