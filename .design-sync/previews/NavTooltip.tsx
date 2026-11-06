import { NavTooltip } from '@ohma/ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faCog } from '@fortawesome/free-solid-svg-icons'

const IconButton = ({ icon }: { icon: typeof faCog }) => (
    <button style={{
        display: 'grid',
        placeItems: 'center',
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: 'var(--rounding)',
        border: 'none',
        background: 'var(--color-base-200)',
        color: 'var(--color-base-content)',
        fontSize: '1.1rem',
        cursor: 'pointer',
    }}>
        <FontAwesomeIcon icon={icon} />
    </button>
)

/**
 * NavTooltip renders its children bare until after mount (a deliberate
 * hydration-safety measure), then wraps them in a Radix tooltip. The tooltip
 * itself only appears on hover/focus, which a static card cannot trigger — so
 * these cards show the trigger in its resting state.
 */
export const AroundIcon = () => (
    <NavTooltip content="Admin">
        <IconButton icon={faCog} />
    </NavTooltip>
)

export const SideBarColumn = () => (
    <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
        <NavTooltip content="Hvad der hender">
            <IconButton icon={faCalendar} />
        </NavTooltip>
        <NavTooltip content="Admin">
            <IconButton icon={faCog} />
        </NavTooltip>
    </div>
)
