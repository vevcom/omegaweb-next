'use client'
import { SUCCESS_FEEDBACK_TIME } from './constants'
import { FormContext, FormInputSlot, flattenChildren, inputName } from './FormContext'
import FormSection from './FormSection'
import FormTab from './FormTab'
import { useUnsavedChanges } from './useUnsavedChanges'
import { PopUpContext } from '@/contexts/PopUp'
import Button from '@/components/UI/Button'
import SubmitButton from '@/components/UI/SubmitButton'
import useSiteRouter from '@/hooks/useSiteRouter'
import React, { Children, isValidElement, useContext, useRef, useState } from 'react'
import type { AppHref } from '@/lib/sites/href'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { Colors, Confirmation } from '@/components/UI/SubmitButton'
import type { FormHTMLAttributes, ReactNode, DetailedHTMLProps } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { ErrorMessage } from '@/services/error'

type FormType = DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>
export type PropTypes<ReturnType> = Omit<FormType, 'action' | 'children'> & {
    children?: ReactNode,
    title?: string,
    submitText?: ReactNode,
    submitColor?: Colors,
    confirmation?: Confirmation,
    action: ActionFormData<ReturnType>,
    successCallback?: (data?: ReturnType) => void,
    refreshOnSuccess?: boolean,
    navigateOnSuccess?: AppHref | ((data?: ReturnType) => AppHref | null),
    closePopUpOnSuccess?: PopUpKeyType,
    buttonClassName?: string,
    disabled?: boolean,
    /** A second way to submit, sent along as the field named, with 'on' as its value. */
    secondarySubmit?: { text: ReactNode, name: string, color?: Colors },
    /**
     * Keeps saving at the bottom of a long form, says whether there is anything to save and offers
     * to discard it. Discarding resets the form, which a field holding its value in state follows
     * with `useFormReset`.
     */
    saveBar?: boolean,
    /** Told what the form would submit, on mount and on every change. */
    onValuesChange?: (values: FormData) => void,
}
/**
 * The names of the inputs among the children that have room for their errors, those inside sections
 * included. An input placed straight in a tab has none, so its errors are shown with the general ones.
 */
function collectInputNames(children: ReactNode, inTab = false): string[] {
    return Children.toArray(children).flatMap(child => {
        if (isValidElement<{ children?: ReactNode }>(child) && (child.type === FormSection || child.type === FormTab)) {
            return collectInputNames(flattenChildren(child.props.children), child.type === FormTab)
        }
        if (inTab) return []
        const name = inputName(child)
        return name ? [name] : []
    })
}

export default function Form<GiveActionReturn>({
    children,
    title,
    submitText = 'Opprett',
    submitColor = 'primary',
    confirmation = {
        confirm: false,
    },
    action,
    successCallback,
    className,
    refreshOnSuccess,
    navigateOnSuccess,
    closePopUpOnSuccess,
    buttonClassName,
    disabled,
    secondarySubmit,
    saveBar,
    onValuesChange,
    ...props
}: PropTypes<GiveActionReturn>) {
    const [generalErrors, setGeneralErrors] = useState<ErrorMessage[]>()
    const [inputErrors, setInputErrors] = useState<Partial<Record<string, ErrorMessage[]>>>({})
    const [refusedNames, setRefusedNames] = useState<string[]>([])
    const [success, setSuccess] = useState(false)
    const [pending, setPending] = useState(false)
    // Which button submitted, so only it shows the wait and the check mark.
    const [submitter, setSubmitter] = useState<'primary' | 'secondary'>('primary')
    const PopUpCtx = useContext(PopUpContext)
    const { refresh, push } = useSiteRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const { dirty, markSaved } = useUnsavedChanges(
        formRef,
        Boolean(saveBar) || onValuesChange !== undefined,
        onValuesChange,
    )

    const actionWithError = async (formData: FormData) => {
        setGeneralErrors(undefined)
        setInputErrors({})
        setRefusedNames([])

        const res = await action(formData)

        if (res.success) {
            setSuccess(true)
            markSaved(formData)
            successCallback?.(res.data)
            if (closePopUpOnSuccess) {
                setTimeout(() => {
                    PopUpCtx?.remove(closePopUpOnSuccess)
                }, 2000)
            }
            setTimeout(() => {
                setSuccess(false)
                if (refreshOnSuccess) refresh()
                if (navigateOnSuccess) {
                    // An app path, rendered for the domain the visitor is on.
                    if (typeof navigateOnSuccess === 'string') {
                        push(navigateOnSuccess)
                    } else if (typeof navigateOnSuccess === 'function') {
                        const x = navigateOnSuccess(res.data)
                        if (x) push(x)
                    }
                }
            }, SUCCESS_FEEDBACK_TIME)
            return
        }
        //No error provided
        if (!res.error) {
            setGeneralErrors([
                {
                    path: [],
                    message: 'Noe gikk galt. Prøv igjen.'
                }
            ])
            return
        }

        const labels = collectInputNames(children)
        const errorsByLabel: Partial<Record<string, ErrorMessage[]>> = {}
        const unmatchedErrors: ErrorMessage[] = []
        res.error.forEach(error => {
            const label = error.path?.[0]
            if (typeof label === 'string' && labels.includes(label)) {
                errorsByLabel[label] = [...(errorsByLabel[label] ?? []), error]
            } else {
                unmatchedErrors.push(error)
            }
        })
        setInputErrors(errorsByLabel)
        if (unmatchedErrors.length > 0) setGeneralErrors(unmatchedErrors)
        // Every field refused, whichever way its error is shown, so that a tab can say it holds one.
        setRefusedNames(Array.from(new Set(res.error.flatMap(error => {
            const label = error.path?.[0]
            return typeof label === 'string' ? [label] : []
        }))))
    }

    // Tracked here since useFormStatus only covers a transition started during the submit event.
    // That misses an action which awaits something before its first server action, such as a Stripe
    // checkout, and everything after that server action.
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (pending) return
        // With the button that submitted, so its name and value are sent as a field.
        const button = (event.nativeEvent as SubmitEvent).submitter
        const formData = new FormData(event.currentTarget, button instanceof HTMLButtonElement ? button : null)
        setSubmitter(button instanceof HTMLButtonElement && button.name === secondarySubmit?.name ? 'secondary' : 'primary')
        setPending(true)
        try {
            await actionWithError(formData)
        } finally {
            setPending(false)
        }
    }

    // What was refused belongs to what is discarded.
    const handleReset = () => {
        setGeneralErrors(undefined)
        setInputErrors({})
        setRefusedNames([])
    }

    const submitButton = <div className={secondarySubmit ? 'flex flex-wrap items-start gap-x-2' : 'contents'}>
        {/* The two buttons stay together, on one line wherever there is room for both. */}
        <SubmitButton
            color={submitColor}
            success={success && submitter === 'primary'}
            generalErrors={generalErrors}
            confirmation={confirmation}
            pending={pending && submitter === 'primary'}
            className={`
                ${buttonClassName}
                m-0
            `}
            disabled={disabled || (pending && submitter !== 'primary') || (saveBar && !dirty && !success)}
        >
            {submitText}
        </SubmitButton>
        {secondarySubmit && <SubmitButton
            color={secondarySubmit.color ?? 'secondary'}
            success={success && submitter === 'secondary'}
            confirmation={confirmation}
            pending={pending && submitter === 'secondary'}
            className={`
                ${buttonClassName}
                m-0
            `}
            disabled={disabled || (pending && submitter !== 'secondary')}
            name={secondarySubmit.name}
            value="on"
        >
            {secondarySubmit.text}
        </SubmitButton>}
    </div>

    return (
        <FormContext.Provider value={{ inputErrors, refusedNames, pending }}>
            <form ref={formRef} className={`
                relative w-full
                [&>h2]:mb-2
                ${className}
            `} {...props} onSubmit={handleSubmit} onReset={handleReset}>
                {title && <h2 className="text-base-content">{title}</h2>}
                {Children.toArray(children).map((child, index) => {
                    if (isValidElement(child) && child.type === FormTab) return child
                    const name = inputName(child)
                    return <FormInputSlot
                        key={index}
                        input={child}
                        errors={(name && inputErrors[name]) || []}
                        pending={pending}
                    />
                })}
                {saveBar ? <div className="
                    sticky -bottom-1 z-2 flex items-start justify-between gap-3 mt-auto pt-3 pb-1 border-t border-base-300
                    bg-base-100
                ">
                    <p className="m-0 py-2 text-base-content/80">
                        {dirty ? 'Du har ulagrede endringer.' : 'Alt er lagret.'}
                    </p>
                    <div className="flex items-start gap-2">
                        {dirty && <Button type="reset" color="secondary" className="m-0">
                            Forkast
                        </Button>}
                        {submitButton}
                    </div>
                </div> : submitButton}
            </form>
        </FormContext.Provider>
    )
}
