'use client'
import useMenu from '@/hooks/useMenu'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode,
}

export default function RevueMobileMenu({ children }: PropTypes) {
    const { open, setOpen, close, ref, toggleRef, closeWhenFocusLeaves } = useMenu()

    return (
        <div ref={ref} onBlur={closeWhenFocusLeaves} className="mobile:hidden">
            <button
                ref={toggleRef}
                type="button"
                className="
                    inline-flex items-center justify-center size-10 rounded-full border-none bg-transparent
                    text-base-content cursor-pointer transition-colors
                    hover:bg-base-300
                    focus-visible:outline-2 focus-visible:outline-accent
                "
                aria-label={open ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                <FontAwesomeIcon icon={open ? faXmark : faBars} className="size-5!" />
            </button>
            {open && (
                <div
                    className="
                        absolute inset-x-0 top-full z-4 flex flex-col py-2 bg-base-200 border-b border-accent/30
                        shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)]
                    "
                    onClick={close}
                >
                    {children}
                </div>
            )}
        </div>
    )
}
