import styles from './SubmitButton.module.scss'
import { popUpClassNames } from '@/components/PopUp/popUpClassNames'
import Button from '@/components/UI/Button'
import { PopUpContext } from '@/contexts/PopUp'
import React, { useContext, useEffect, useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { useFormStatus } from 'react-dom'
import type { ErrorMessage } from '@/services/error'
import type { ReactNode } from 'react'
import type { PropTypes as ButtonPropTypes } from '@/components/UI/Button'

/**
 * How long the confirmation dialog stays up after a successful submit, so that the check mark is
 * seen before the dialog closes itself.
 */
const CONFIRMATION_CLOSE_DELAY = 2000

export type Colors = ButtonPropTypes['color']
export type Confirmation = {
    confirm: boolean,
    text?: string,
}

const submitButtonClassName = 'w-40 m-0 text-text-inv transition-colors duration-300 ease-in-out'

export default function SubmitButton({
    children,
    generalErrors,
    success,
    color,
    confirmation,
    className,
    pending,
    onClick,
    disabled,
}: {
    children: ReactNode,
    generalErrors?: ErrorMessage[],
    success: boolean,
    color: Colors,
    confirmation?: Confirmation,
    className?: string,
    pending?: boolean,
    onClick?: React.MouseEventHandler<HTMLButtonElement>,
    disabled?: boolean,
}) {
    const formStatus = useFormStatus()
    pending ??= formStatus.pending

    const [confirmedOpen, setConfirmedOpen] = useState(false)
    const popUpKey = useId()
    const popUpContext = useContext(PopUpContext)
    // The real submit button must stay inside the <form>'s DOM tree. The popup
    // itself is teleported out to the app-wide PopUpProvider (a sibling of the
    // form, not a descendant), so a submit button rendered there has nothing
    // to submit.
    const realSubmitRef = useRef<HTMLButtonElement>(null)

    const renderButtonContent = (label: ReactNode) => {
        if (pending) {
            return (
                <div className={`flex justify-between px-[20px] py-px ${styles.loader}`}>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            )
        }
        if (success) {
            return (
                <FontAwesomeIcon icon={faCircleCheck} />
            )
        }
        return label
    }
    const button = (
        <Button
            className={`${submitButtonClassName} ${className ?? ''}`}
            aria-disabled={pending || success}
            color={success ? 'green' : color}
            type="submit"
            onClick={onClick}
            disabled={disabled}
        >
            {renderButtonContent(children)}
        </Button>
    )

    // The confirmation asks a question that a successful submit has now answered - leaving it up
    // means the user has to dismiss a dialog for something that already happened. Nothing else
    // closes it: the X and 'Nei' are the only other ways out.
    useEffect(() => {
        if (!success) return undefined
        const timeout = setTimeout(() => setConfirmedOpen(false), CONFIRMATION_CLOSE_DELAY)
        return () => clearTimeout(timeout)
    }, [success])

    // The dialog is teleported into the app-wide PopUpProvider, so it outlives this button unless it
    // is taken down explicitly. A successful submit often removes the form from the page - a
    // migrated group stops offering migration, a removed member stops offering removal - and the
    // dialog would then be left on screen with nothing able to close it. The cleanup runs with the
    // context of the last render, which is the one that knows this dialog is the open one.
    useEffect(() => {
        if (!popUpContext) return undefined
        if (!confirmedOpen) {
            popUpContext.remove(popUpKey)
            return undefined
        }
        popUpContext.teleport(
            <div className={popUpClassNames.popUp}>
                <div className={popUpClassNames.main}>
                    <div className={popUpClassNames.overflow}>
                        <button className={popUpClassNames.closeBtn} onClick={() => setConfirmedOpen(false)}>
                            <FontAwesomeIcon icon={faX} />
                        </button>
                        <div>
                            <p>{confirmation?.text || 'Er du sikker?'}</p>
                            <div className="flex justify-center gap-2 mt-4">
                                <Button
                                    type="button"
                                    color="secondary"
                                    onClick={() => setConfirmedOpen(false)}
                                >
                                    Nei
                                </Button>
                                <Button
                                    className={`${submitButtonClassName} ${className ?? ''}`}
                                    aria-disabled={pending || success}
                                    color={success ? 'green' : color}
                                    type="button"
                                    disabled={disabled || pending || success}
                                    onClick={() => realSubmitRef.current?.click()}
                                >
                                    {renderButtonContent('Ja')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>,
            popUpKey
        )
        return () => popUpContext.remove(popUpKey)
    }, [confirmedOpen, pending, success, popUpKey])

    return (
        <div>
            {
                (confirmation?.confirm) ? (
                    <>
                        <Button
                            className={`${submitButtonClassName} ${className ?? ''}`}
                            color={color}
                            type="button"
                            onClick={() => setConfirmedOpen(true)}
                        >
                            {children}
                        </Button>
                        <button
                            ref={realSubmitRef}
                            type="submit"
                            onClick={onClick}
                            disabled={disabled}
                            aria-hidden="true"
                            tabIndex={-1}
                            className="w-[0.1px] max-w-[0.1px] h-[0.1px] opacity-0 overflow-hidden absolute -z-1"
                        />
                    </>
                ) : (
                    button
                )
            }

            <p className={`flex flex-col min-h-[1.15em] mb-[3px] text-accent-red ${pending ? 'invisible' : ''}`}>
                {
                    generalErrors?.[0]?.message
                }
            </p>
        </div>
    )
}
