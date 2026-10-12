'use client'

import styles from './PopUp.module.scss'
import useKeyPress from '@/hooks/useKeyPress'
import { PopUpContext } from '@/contexts/PopUp'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useContext, useEffect, useState, useRef, useCallback, useEffectEvent } from 'react'
import type { ReactNode, CSSProperties, RefObject } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'

type DialogPropTypes = {
    children: ReactNode,
    mainRef: RefObject<HTMLDivElement | null>,
    triggerRef: RefObject<HTMLButtonElement | null>,
    close: () => void,
}

/**
 * The open pop-up, as it is teleported to the PopUpProvider. It is keyed by the pop-up key, so it
 * mounts when the pop-up opens and unmounts when it closes, which is when focus is moved into it and
 * given back to whatever opened it.
 */
function PopUpDialog({ children, mainRef, triggerRef, close }: DialogPropTypes) {
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        // Safari does not focus a button when it is clicked, so the pop-up's own trigger is preferred.
        const returnFocusTo = triggerRef.current
            ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
        closeButtonRef.current?.focus({ preventScroll: true })
        return () => returnFocusTo?.focus({ preventScroll: true })
    }, [triggerRef])

    return (
        <div className={styles.PopUp}>
            <div className={styles.main} ref={mainRef} role="dialog" aria-modal="true">
                <div className={styles.overflow}>
                    <button ref={closeButtonRef} className={styles.closeBtn} onClick={close} aria-label="Lukk">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                    <div className={styles.content}>
                        { children }
                    </div>
                </div>
            </div>
        </div>
    )
}

export type PropTypes = {
    children: ReactNode,
    customShowButton?: (open: () => void) => ReactNode,
    showButtonContent?: ReactNode,
    showButtonClass?: string,
    showButtonStyle?: CSSProperties,
    storeInUrl?: boolean,
    popUpKey: PopUpKeyType
}

export default function PopUp({
    popUpKey,
    children,
    customShowButton,
    showButtonContent,
    showButtonClass,
    showButtonStyle,
    storeInUrl = false,
}: PropTypes) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathName = usePathname()
    const [isOpen, setIsOpen] = useState(false)

    const popUpContext = useContext(PopUpContext)
    useKeyPress('Escape', () => setIsOpen(false))
    const ref = useClickOutsideRef(() => setIsOpen(false))
    const contentRef = useRef<ReactNode>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    if (!popUpContext) throw new Error('Trenger PopUpContext for pop-up-vinduer')

    const { teleport, remove, keyOfCurrentNode } = popUpContext

    const handleTeleportOrRemove = useEffectEvent(() => {
        if (isOpen) {
            teleport(contentRef.current, popUpKey)
        } else {
            remove(popUpKey)
        }
    })

    useEffect(() => {
        handleTeleportOrRemove()
    }, [isOpen, popUpKey])

    const handleCloseIfNotCurrent = useEffectEvent(() => {
        if (popUpContext.keyOfCurrentNode !== popUpKey) {
            setIsOpen(false)
        }
    })

    useEffect(() => {
        handleCloseIfNotCurrent()
    }, [keyOfCurrentNode, popUpKey])

    useEffect(() => {
        contentRef.current = (
            <PopUpDialog key={popUpKey} mainRef={ref} triggerRef={triggerRef} close={() => setIsOpen(false)}>
                { children }
            </PopUpDialog>
        )
        if (isOpen) {
            teleport(contentRef.current, popUpKey)
        }
    }, [children, isOpen, popUpKey, teleport, ref])

    const handleSearchParamsChange = useEffectEvent(() => {
        if (!storeInUrl) return

        const params = new URLSearchParams(searchParams.toString())
        const keyInUrl = params.get('pop-up-key') === popUpKey

        if (keyInUrl && !isOpen) {
            setIsOpen(true)
        }
    })

    useEffect(() => {
        handleSearchParamsChange()
    }, [searchParams])

    const handleIsOpenChange = useEffectEvent(() => {
        if (!storeInUrl) return

        const params = new URLSearchParams(searchParams.toString())
        const keyInUrl = params.get('pop-up-key') === popUpKey

        if (isOpen) {
            // Set the pop-up key in the URL to indicate that this pop-up is open.
            // There should only be one pop-up open at a time, so we can just set it directly.
            params.set('pop-up-key', String(popUpKey))
        } else if (keyInUrl) {
            // We check if the key is our key to avoid removing another pop-up's key.
            params.delete('pop-up-key')
        }

        const newUrl = `${pathName}?${params.toString()}`
        const oldUrl = `${pathName}?${searchParams.toString()}`

        if (newUrl !== oldUrl) {
            router.replace(`${pathName}?${params.toString()}`)
        }
    })

    useEffect(() => {
        handleIsOpenChange()
    }, [isOpen])

    const handleOpening = useCallback(() => {
        setIsOpen(true)
    }, [])

    return <>{
        customShowButton ? (
            customShowButton(handleOpening)
        ) : (
            <button
                ref={triggerRef}
                className={`${styles.openBtn} ${showButtonClass}`}
                style={showButtonStyle}
                onClick={handleOpening}
            >
                {showButtonContent}
            </button>
        )
    }</>
}
