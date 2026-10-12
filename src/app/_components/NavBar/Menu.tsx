'use client'
import styles from './Menu.module.scss'
import stylesNav from './NavBar.module.scss'
import useKeyPress from '@/hooks/useKeyPress'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useOnNavigation from '@/hooks/useOnNavigation'
import { useGlobalSearch } from '@/contexts/GlobalSearch'
import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { NavLink } from './navDef'

type PropTypes = {
    openBtnVariant: 'mobile' | 'desktop',
    items: NavLink[]
}


export default function Menu({ items, openBtnVariant }: PropTypes) {
    const [isOpen, setIsOpen] = useState(false)
    const globalSearch = useGlobalSearch()
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
                        <div ref={menuRef} className={styles.Menu}>
                            <div>
                                <div>
                                    <button
                                        type="button"
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
                                    <div key={item.name}>
                                        <Link href={item.href}>
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
                className={styles.openBtn}
                aria-label={isOpen ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={isOpen}
                onClick={() => (isOpen ? closeMenu(menuRef) : setIsOpen(true))}
            >
                {openBtnVariant === 'mobile' &&
                    <div className={`${styles.menuBtn} ${isOpen ? styles.open : ''}`}>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                }
                {openBtnVariant === 'desktop' && !isOpen &&
                    <p className={stylesNav.openMenu}>Mer</p>
                }
                {openBtnVariant === 'desktop' && isOpen &&
                    <p className={stylesNav.openMenu}>Mindre</p>
                }
            </button>
        </>
    )
}
