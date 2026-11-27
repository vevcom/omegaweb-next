import type { ReactNode } from 'react'

/**
 * An error where a section would have been, in the section's own shape: its fallback, dimmed and
 * still, with the message and what to do about it over it. The two share one grid cell, so the
 * error is as large as the fallback unless the message needs more room. It is rendered on the
 * server for a service error and by the section's boundary for a bug, so it has no hooks.
 */
export default function SuspendfulError({ shape, message, action }: {
    shape: ReactNode,
    message: string,
    action: ReactNode,
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)]" role="alert">
            <div aria-hidden inert className="
                col-start-1 row-start-1 opacity-30
                **:animate-none!
            ">{shape}</div>
            <div className="
                relative col-start-1 row-start-1 flex flex-col items-center justify-center gap-2 p-2 text-center
            ">
                <p className="text-m">{message}</p>
                {action}
            </div>
        </div>
    )
}
