'use client'
import useMenu from '@/hooks/useMenu'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode,
}

type DropdownPropTypes = PropTypes & {
    label: string,
}

export function CareersNavDropdown({ label, children }: DropdownPropTypes) {
    const { open, setOpen, close, ref, toggleRef, closeWhenFocusLeaves } = useMenu()

    return (
        <div ref={ref} onBlur={closeWhenFocusLeaves} className="relative">
            <button
                ref={toggleRef}
                type="button"
                className="
                    inline-flex items-center gap-1.5 border-none bg-transparent text-s font-medium whitespace-nowrap
                    text-careers-navy/60 cursor-pointer transition-colors
                    hover:text-careers-navy
                    [&_svg]:size-[0.7em] [&_svg]:text-inherit
                    [&_path]:text-inherit
                "
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                {label}
                <FontAwesomeIcon icon={faChevronDown} className={`
                    transition-transform duration-200
                    ${open ? 'rotate-180' : ''}
                `} />
            </button>
            {open && (
                <div
                    className="
                        absolute right-0 top-full z-4 flex flex-col w-56 mt-3 p-1.5 bg-white border border-careers-navy/10
                        shadow-lg
                    "
                    onClick={close}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

/** The button and slide-down menu holding the navigation on narrow screens. */
export function CareersMobileMenu({ children }: PropTypes) {
    const { open, setOpen, close, ref, toggleRef, closeWhenFocusLeaves } = useMenu()

    return (
        <div ref={ref} onBlur={closeWhenFocusLeaves}>
            <button
                ref={toggleRef}
                type="button"
                className="
                    inline-flex items-center justify-center size-10 border-none bg-transparent text-careers-navy
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
                <div className="absolute inset-x-0 top-full z-4" onClick={close}>
                    <div className="flex flex-col mx-4 bg-white border border-careers-navy/10 shadow-xl">
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}
