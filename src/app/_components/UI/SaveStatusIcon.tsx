import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faPen, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

const statuses = {
    untouched: null,
    saved: { label: 'Lagret', icon: faCheck, className: 'text-success' },
    unsaved: { label: 'Ikke lagret', icon: faPen, className: 'text-base-content/60' },
    saving: { label: 'Lagrer...', icon: faSpinner, className: 'text-base-content/60' },
    failed: { label: 'Kunne ikke lagre', icon: faTriangleExclamation, className: 'text-error' },
}

export type SaveStatus = keyof typeof statuses

/**
 * Where something that saves itself is, as an icon in the top right corner of what is around it:
 * nothing before the first change, then not saved, saving, saved or failed.
 */
export default function SaveStatusIcon({ status }: { status: SaveStatus }) {
    const shown = statuses[status]
    return (
        <span
            role="status"
            data-save-status
            title={shown?.label}
            aria-label={shown?.label}
            className={`
                absolute -top-[10px] -right-[10px] z-2 size-8 grid place-items-center rounded-inner cursor-default
                ${shown ? `
                    bg-base-200
                    ${shown.className}
                ` : ''}
            `}
        >
            {shown && <FontAwesomeIcon icon={shown.icon} spin={status === 'saving'} />}
        </span>
    )
}
