'use client'
import { SUCCESS_FEEDBACK_TIME } from './constants'
import { PopUpContext } from '@/contexts/PopUp'
import SubmitButton from '@/components/UI/SubmitButton'
import React, { Children, useContext, useEffect, useState, useEffectEvent } from 'react'
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
type InputType = {
    input: ReactNode,
    label?: string,
    errors: ErrorMessage[],
}
type Inputs = InputType[]

function Input({ input, errors, pending }: InputType & { pending: boolean }) {
    return (
        <span>
            <div>
                {input}
            </div>
            <p className={`
                text-accent-red flex flex-col min-h-[1.15em] mb-[3px]
                ${pending ? 'invisible' : ''}
            `}>
                {
                    errors?.[0]?.message
                }
            </p>
        </span>
    )
}

function hasProps(obj: unknown): obj is { props: { name?: string; id?: string } } {
    return typeof obj === 'object' &&
        obj !== null && 'props' in obj &&
        typeof obj.props === 'object'
        && obj.props !== null
}

const makeInputArray = (children: ReactNode): Inputs =>
    Children.toArray(children).map((child) => {
        if (typeof child !== 'object' || !child) {
            return {
                input: child,
                label: undefined,
                errors: [],
            }
        }
        let name: string | undefined = undefined
        let id: string | undefined = undefined
        if (hasProps(child)) {
            if (typeof child.props.name === 'string') name = child.props.name
            if (typeof child.props.id === 'string') id = child.props.id
        }
        return {
            input: child,
            label: name || id,
            errors: [],
        }
    })

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
    const [inputs, setInputs] = useState<Inputs>(makeInputArray(children))
    const [success, setSuccess] = useState(false)
    const [pending, setPending] = useState(false)
    const PopUpCtx = useContext(PopUpContext)
    const { refresh, push } = useRouter()

    const updateInputs = useEffectEvent(() => {
        setInputs(makeInputArray(children))
    })

    useEffect(() => {
        updateInputs()
    }, [children])

    const actionWithError = async (formData: FormData) => {
        const inputs_ = makeInputArray(children)
        setGeneralErrors(() => undefined)
        setInputs(() => inputs_)

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

        //sort errors
        res.error.forEach(error => {
            if (error.path === undefined) return setGeneralErrors((prev) => (prev ? [...prev, error] : [error]))
            const inputWithError = inputs_.find((input) => input.label === (error.path ?? [])[0])
            if (inputWithError) return inputWithError.errors.push(error)
            return setGeneralErrors((prev) => (prev ? [...prev, error] : [error]))
        })
        setInputs(inputs_)
        return
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
        <form className={`
            relative w-full
            [&>h2]:mb-2
            ${className}
        `} {...props} onSubmit={handleSubmit}>
            {title && <h2>{title}</h2>}
            {
                inputs.map(({ input, errors }, i) => (
                    <Input input={input} errors={errors} pending={pending} key={i} />
                ))
            }
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
    )
}
