'use client'

import { popUpClassNames } from './popUpClassNames'
import useKeyPress from '@/hooks/useKeyPress'
import { InsidePopUpContext, PopUpContext } from '@/contexts/PopUp'
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
        <div className={popUpClassNames.popUp}>
            <div className={popUpClassNames.main} ref={mainRef} role="dialog" aria-modal="true">
                <div className={popUpClassNames.overflow}>
                    <button ref={closeButtonRef} className={popUpClassNames.closeBtn} onClick={close} aria-label="Lukk">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                    <div>
                        <InsidePopUpContext.Provider value={true}>
                            { children }
                        </InsidePopUpContext.Provider>
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
    /** The accessible name of the button that opens the pop-up, for one that shows only an icon. */
    ariaLabel?: string,
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
    ariaLabel,
    storeInUrl = false,
}: PropTypes) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathName = usePathname()
    const [isOpen, setIsOpen] = useState(() => storeInUrl && searchParams.get('pop-up-key') === String(popUpKey))

    const popUpContext = useContext(PopUpContext)
    useKeyPress('Escape', () => setIsOpen(false))
    const ref = useClickOutsideRef(() => setIsOpen(false))
    const contentRef = useRef<ReactNode>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    if (!popUpContext) throw new Error('Trenger PopUpContext for pop-up-vinduer')

    const { teleport, remove, keyOfCurrentNode } = popUpContext

    // Another pop-up took over, or the provider cleared on navigation.
    const [prevKeyOfCurrentNode, setPrevKeyOfCurrentNode] = useState(keyOfCurrentNode)
    if (prevKeyOfCurrentNode !== keyOfCurrentNode) {
        setPrevKeyOfCurrentNode(keyOfCurrentNode)
        if (keyOfCurrentNode !== popUpKey) setIsOpen(false)
    }

    const [prevSearchParams, setPrevSearchParams] = useState(searchParams)
    if (prevSearchParams !== searchParams) {
        setPrevSearchParams(searchParams)
        if (storeInUrl && searchParams.get('pop-up-key') === String(popUpKey)) setIsOpen(true)
    }

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

    // The dialog lives in the PopUpProvider, so it would outlast this pop-up when the pop-up goes
    // away while open, for example along with the thing it was deleting.
    useEffect(() => () => remove(popUpKey), [remove, popUpKey])

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
                className={`
                    hover:cursor-pointer
                    [&>svg]:size-full
                    ${showButtonClass}
                `}
                style={showButtonStyle}
                aria-label={ariaLabel}
                title={ariaLabel}
                onClick={handleOpening}
            >
                {showButtonContent}
            </button>
        )
    }</>
}
