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
                    inline-flex items-center justify-center size-10 border-none bg-transparent text-base-content
                    cursor-pointer
                    [&_svg]:size-5 [&_svg]:text-inherit
                    [&_path]:text-inherit
                "
                aria-label={open ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                <FontAwesomeIcon icon={open ? faXmark : faBars} />
            </button>
            {open && (
                <div
                    className="
                        absolute inset-x-0 top-full z-4 flex flex-col bg-base-200 border-b border-base-300 shadow-lg
                    "
                    onClick={close}
                >
                    {children}
                </div>
            )}
        </div>
    )
}
