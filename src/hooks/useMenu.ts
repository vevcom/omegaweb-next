import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useKeyPress from '@/hooks/useKeyPress'
import useOnNavigation from '@/hooks/useOnNavigation'
import { useRef, useState } from 'react'
import type { FocusEvent } from 'react'

/**
 * The state of a menu opened by a toggle button. The menu closes on navigation, on a click outside
 * and when focus leaves it, and on Escape, which gives focus back to the toggle.
 */
export default function useMenu() {
    const [open, setOpen] = useState(false)
    const close = () => setOpen(false)
    const toggleRef = useRef<HTMLButtonElement>(null)
    useOnNavigation(close)
    useKeyPress('Escape', () => {
        if (!open) return
        close()
        toggleRef.current?.focus()
    })
    const ref = useClickOutsideRef(close)

    // Safari does not focus a link that is clicked, so only a focus that lands somewhere else closes the menu.
    const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close()
    }

    return { open, setOpen, close, ref, toggleRef, closeWhenFocusLeaves }
}
