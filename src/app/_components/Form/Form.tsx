'use client'
import { SUCCESS_FEEDBACK_TIME } from './constants'
import { FormContext, FormInputSlot, flattenChildren, inputName } from './FormContext'
import FormSection from './FormSection'
import { PopUpContext } from '@/contexts/PopUp'
import SubmitButton from '@/components/UI/SubmitButton'
import React, { Children, isValidElement, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
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
    navigateOnSuccess?: string | ((data?: ReturnType) => string | null),
    closePopUpOnSuccess?: PopUpKeyType,
    buttonClassName?: string,
    disabled?: boolean,
}
/** The names of every input among the children, those inside sections included, so their errors find them. */
function collectInputNames(children: ReactNode): string[] {
    return Children.toArray(children).flatMap(child => {
        if (isValidElement<{ children?: ReactNode }>(child) && child.type === FormSection) {
            return collectInputNames(flattenChildren(child.props.children))
        }
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
    ...props
}: PropTypes<GiveActionReturn>) {
    const [generalErrors, setGeneralErrors] = useState<ErrorMessage[]>()
    const [inputErrors, setInputErrors] = useState<Partial<Record<string, ErrorMessage[]>>>({})
    const [success, setSuccess] = useState(false)
    const [pending, setPending] = useState(false)
    const PopUpCtx = useContext(PopUpContext)
    const { refresh, push } = useRouter()

    const actionWithError = async (formData: FormData) => {
        setGeneralErrors(undefined)
        setInputErrors({})

        const res = await action(formData)

        if (res.success) {
            setSuccess(true)
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
    }

    // Tracked here since useFormStatus only covers a transition started during the submit event.
    // That misses an action which awaits something before its first server action, such as a Stripe
    // checkout, and everything after that server action.
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (pending) return
        const formData = new FormData(event.currentTarget)
        setPending(true)
        try {
            await actionWithError(formData)
        } finally {
            setPending(false)
        }
    }

    return (
        <FormContext.Provider value={{ inputErrors, pending }}>
            <form className={`
                relative w-full
                [&>h2]:mb-2
                ${className}
            `} {...props} onSubmit={handleSubmit}>
                {title && <h2>{title}</h2>}
                {Children.toArray(children).map((child, index) => {
                    const name = inputName(child)
                    return <FormInputSlot
                        key={index}
                        input={child}
                        errors={(name && inputErrors[name]) || []}
                        pending={pending}
                    />
                })}
                <SubmitButton
                    color={submitColor}
                    success={success}
                    generalErrors={generalErrors}
                    confirmation={confirmation}
                    pending={pending}
                    className={`
                        ${buttonClassName}
                        m-0
                    `}
                    disabled={disabled}
                >
                    {submitText}
                </SubmitButton>
            </form>
        </FormContext.Provider>
    )
}
