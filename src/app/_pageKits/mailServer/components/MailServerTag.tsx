import type { ReactNode } from 'react'

/** A small tag on a node of the mail server naming what the viewer is to it, such as its owner. */
export default function MailServerTag({ children }: { children: ReactNode }) {
    return <span
        className="
            text-[0.7rem] uppercase tracking-[0.06em] py-0.5 px-1.5 rounded-round bg-accent-blue text-text-inv flex-none
        "
    >
        {children}
    </span>
}
