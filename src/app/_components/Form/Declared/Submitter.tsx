'use client'
import { checkValues } from './checkValues'
import { makeField } from './Field'
import { createFormStore } from './formStore'
import { InsideSubmitterContext } from './insideSubmitterContext'
import { kinds } from './Kinds/kinds'
import { SUCCESS_FEEDBACK_TIME } from '@/components/Form/constants'
import SubmitButton from '@/components/UI/SubmitButton'
import { PopUpContext } from '@/contexts/PopUp'
import useCapability from '@/hooks/useCapability'
import useSiteRouter from '@/hooks/useSiteRouter'
import { createActionError } from '@/services/actionError'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FieldOf } from './Field'
import type { FormStore, FormValues } from './formStore'
import type { SpecsOf } from './Kinds/kind'
import type { Colors, Confirmation } from '@/components/UI/SubmitButton'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { CallableCapability, CapabilityInput, DecidedCapability } from '@/hooks/useCapability'
import type { ActionReturn } from '@/services/actionTypes'
import type { Rule } from '@/services/serviceContract'
import type { FormEvent, ReactNode } from 'react'

const POP_UP_CLOSE_TIME = 2000

const GENERAL_ERROR = 'Noe gikk galt. Prøv igjen.'

/**
 * Binds a capability to a form. It is called at module scope in a `'use client'` file, since
 * that is where the schema of the capability can be imported, and gives the submitter and its
 * field. The submitter is rendered around the fields: it holds the values, checks them with the
 * schema of the capability and submits them to its action. It renders nothing for a user who may
 * not submit. The field takes the names of that schema, and writes to that submitter alone. With
 * no field in it, the submitter is a button that calls the action.
 *
 * The submitter takes no function as a prop. What happens after a save is one of its props.
 */
export function makeSubmitter<Params = never, Data extends FormValues = never, EntryRule extends Rule = Rule>({
    capability,
}: {
    capability: CallableCapability<Params, Data, EntryRule>,
}): [(props: SubmitterProps<Params, Data, EntryRule>) => ReactNode, FieldOf<Data, SpecsOf<typeof kinds>>] {
    // One context for each call, so that the field made here reads the store of the submitter made here.
    const OwnStoreContext = createContext<FormStore | null>(null)

    return [Submitter, makeField(OwnStoreContext, kinds)]

    function Submitter(props: SubmitterProps<Params, Data, EntryRule>) {
        const {
            title,
            submitText = 'Opprett',
            submitColor = 'primary',
            confirmation,
            refreshOnSuccess,
            closePopUpOnSuccess,
            defaultValues,
            className,
            children,
        } = props
        const insideAnother = useContext(InsideSubmitterContext)
        const decided = useCapability(capability, props)
        const [store] = useState(() => createFormStore(
            values => (capability.data === undefined ? [] : checkValues(capability.data, values)),
            defaultValues,
        ))
        const submitState = useSyncExternalStore(store.subscribeToForm, store.submitState, store.submitState)
        const generalErrors = useSyncExternalStore(store.subscribeToForm, store.generalErrors, store.generalErrors)
        const popUp = useContext(PopUpContext)
        const { refresh } = useSiteRouter()
        const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
        // What is still to happen after a save belongs to this form, and a pop-up may be opened again before it has.
        useEffect(() => {
            const pending = timers.current
            return () => pending.forEach(clearTimeout)
        }, [])

        if (insideAnother) {
            throw new Error('A submitter is inside another submitter. The browser submits a form inside a form '
                + 'itself, which reloads the page and loses every value, so render the two beside each other.')
        }
        if (!decided.authorized) return null

        const submit = async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const values = store.startSubmit()
            if (values === undefined) return

            const result = await send(decided, values)
            if (!result.success) {
                store.refuse(result.error?.length ? result.error : [{ message: GENERAL_ERROR }])
                return
            }

            store.succeed()
            if (refreshOnSuccess) refresh()
            if (closePopUpOnSuccess !== undefined) {
                timers.current.add(setTimeout(() => popUp?.remove(closePopUpOnSuccess), POP_UP_CLOSE_TIME))
            }
            timers.current.add(setTimeout(store.clearSuccess, SUCCESS_FEEDBACK_TIME))
        }

        return (
            <OwnStoreContext.Provider value={store}><InsideSubmitterContext.Provider value={true}>
                <form className={`
                    relative w-full
                    [&>h2]:mb-2
                    ${className ?? ''}
                `} onSubmit={submit}>
                    {title && <h2 className="text-base-content">{title}</h2>}
                    {children}
                    <SubmitButton
                        color={submitColor}
                        confirmation={confirmation}
                        success={submitState === 'succeeded'}
                        pending={submitState === 'pending'}
                        generalErrors={generalErrors}
                    >
                        {submitText}
                    </SubmitButton>
                </form>
            </InsideSubmitterContext.Provider></OwnStoreContext.Provider>
        )
    }
}

type SubmitterProps<Params, Data, EntryRule extends Rule> = CapabilityInput<Params, EntryRule> & {
    title?: string,
    submitText?: string,
    submitColor?: Colors,
    confirmation?: Confirmation,
    refreshOnSuccess?: boolean,
    closePopUpOnSuccess?: PopUpKeyType,
    /** What the fields start as. They are read once, when the form is first rendered. */
    defaultValues?: Partial<Data>,
    className?: string,
    children?: ReactNode,
}

/** An action that throws and does not return, as one whose request is cut off does, is refused as any other. */
async function send<Data>(decided: DecidedCapability<Data>, values: FormValues): Promise<ActionReturn<unknown>> {
    try {
        if (decided.data === undefined) return await decided.action()
        // The schema has taken the values, which the compiler cannot follow from a parse.
        return await decided.action({ data: values as Data })
    } catch {
        return createActionError('UNKNOWN ERROR')
    }
}
