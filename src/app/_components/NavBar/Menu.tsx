'use client'
import styles from './Menu.module.scss'
import useKeyPress from '@/hooks/useKeyPress'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useOnNavigation from '@/hooks/useOnNavigation'
import { useGlobalSearch } from '@/contexts/GlobalSearch'
import { useNavMenu } from '@/contexts/NavMenu'
import useActiveNavHref from '@/hooks/useActiveNavHref'
import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { NavLink } from './navDef'

type PropTypes = {
    openBtnVariant: 'mobile' | 'desktop',
    items: NavLink[]
}


const entryClassName = `
    m-2 relative flex flex-row justify-start flex-wrap list-none
    max-mobile:w-full
`
const entryLinkClassName = `
    w-60 flex items-center p-4 border-none rounded-round bg-surface-base text-text text-l font-bold cursor-pointer
    [font-family:inherit] no-underline
    hover:text-accent-blue
    [&_svg]:mr-2 [&_svg]:text-text
    hover:[&_svg]:text-accent-blue
    [&_path]:text-inherit
    aria-[current=page]:text-accent-blue
    aria-[current=page]:[&_svg]:text-accent-blue
    max-mobile:[font-size:x-large] max-mobile:w-full
`
const burgerLineClassName = `
    absolute left-0 w-full h-[2px] rounded-[2px] bg-text transition-[rotate,opacity,top] duration-300 ease-[ease]
`

export default function Menu({ items, openBtnVariant }: PropTypes) {
    const { isOpen, setIsOpen } = useNavMenu()
    const globalSearch = useGlobalSearch()
    const activeHref = useActiveNavHref(items.map(item => item.href))
    function closeMenu(ref: React.RefObject<HTMLDivElement | null>) {
        ref?.current?.classList.add(styles.closeMenu)
        setTimeout(() => setIsOpen(false), 400)
    }
    const menuRef = useClickOutsideRef((_, ref) => closeMenu(ref))
    useOnNavigation(() => setIsOpen(false)) //done with no animation
    useKeyPress('Escape', () => closeMenu(menuRef))

    return (
        <>
            {
                isOpen ? (
                    <>
                        <div ref={menuRef} className={`
                            ${styles.Menu}
                            fixed top-[60px] left-0 z-9 layer max-w-[50dvw] w-132 h-[calc(100dvh-60px)] flex justify-start
                            items-start overflow-y-auto overflow-x-hidden
                            max-mobile:w-auto max-mobile:max-w-none max-mobile:h-auto max-mobile:rounded-round
                            max-mobile:top-[calc(64px+2*var(--gap)+env(safe-area-inset-top))]
                            max-mobile:bottom-[calc(64px+2*var(--gap)+env(safe-area-inset-bottom))]
                            max-mobile:left-[calc(var(--gap)+env(safe-area-inset-left))]
                            max-mobile:right-[calc(var(--gap)+env(safe-area-inset-right))]
                        `}>
                            <div className="
                                m-2 relative flex flex-row justify-start flex-wrap
                                max-mobile:top-0 max-mobile:justify-center
                            ">
                                <div className={entryClassName}>
                                    <button
                                        type="button"
                                        className={entryLinkClassName}
                                        onClick={() => {
                                            setIsOpen(false)
                                            globalSearch.setIsOpen(true)
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faMagnifyingGlass}/>
                                        Søk
                                    </button>
                                </div>
                                {items.map((item) => (
                                    <div key={item.name} className={entryClassName}>
                                        <Link
                                            href={item.href}
                                            className={entryLinkClassName}
                                            aria-current={item.href === activeHref ? 'page' : undefined}
                                        >
                                            <FontAwesomeIcon icon={item.icon}/>
                                            {item.name}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : null
            }
            <button
                type="button"
                className="
                    bg-transparent border-none
                    [&_:hover]:cursor-pointer
                "
                aria-label={isOpen ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={isOpen}
                onClick={() => (isOpen ? closeMenu(menuRef) : setIsOpen(true))}
            >
                {openBtnVariant === 'mobile' &&
                    <div className="relative w-[25px] h-[18px]">
                        <span className={`
                            ${burgerLineClassName}
                            ${isOpen ? 'top-[8px] rotate-45' : 'top-0'}
                        `}></span>
                        <span className={`
                            ${burgerLineClassName}
                            top-[8px]
                            ${isOpen ? 'opacity-0' : ''}
                        `}></span>
                        <span className={`
                            ${burgerLineClassName}
                            ${isOpen ? 'top-[8px] -rotate-45' : 'top-[16px]'}
                        `}></span>
                    </div>
                }
                {openBtnVariant === 'desktop' && !isOpen &&
                    <p className="font-medium text-text">Mer</p>
                }
                {openBtnVariant === 'desktop' && isOpen &&
                    <p className="font-medium text-text">Mindre</p>
                }
            </button>
        </>
    )
}
