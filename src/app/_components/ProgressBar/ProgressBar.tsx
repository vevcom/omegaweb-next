import type { CSSProperties } from 'react'

type PropTypes = {
    progress: number
}

/**
 *
 * @param progress - The progress of the progress bar from 0 to 1
 * @returns
 */
export default function ProgressBar({ progress }: PropTypes) {
    return (
        <div className="
            w-full h-[20px] bg-surface-raised rounded-[10px] overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]
        ">
            <div
                className="
                    h-full bg-accent-blue w-[calc(var(--progress)*100%)] transition-[width] duration-300 ease-in-out
                "
                style={{
                    '--progress': progress
                } as CSSProperties}></div>
        </div>
    )
}
