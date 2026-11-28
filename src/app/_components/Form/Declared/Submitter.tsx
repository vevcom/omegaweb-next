'use client'
import { checkValues } from './checkValues'
import { makeField } from './Field'
import { createFormStore } from './formStore'
import { kinds } from './Kinds/kinds'
import { SubmitterContext, submitterStateOf } from './submitterContext'
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
import type { ActionError, ActionReturn } from '@/services/actionTypes'
import type { ErrorMessage } from '@/services/error'
import type { Rule } from '@/services/serviceContract'
import type { FormEvent, ReactNode } from 'react'

const POP_UP_CLOSE_TIME = 2000

const AUTOSAVE_DELAY = 1000

const GENERAL_ERROR = 'Noe gikk galt. Prøv igjen.'

/**
 * Binds a capability to a form. It is called at module scope in a `'use client'` file, since
 * that is where the schema of the capability can be imported, and gives the submitter and its
 * field. The submitter is rendered around the fields: it holds the values, checks them with the
 * schema of the capability and submits them to its action. It renders nothing for a user who may
 * not submit. The field takes the names of that schema, and writes to that submitter alone. With
 * no field in it, the submitter is a button that calls the action. With `autosave` it has no button
 * and saves itself.
 *
 * The submitter takes no function as a prop. What happens after a save is one of its props.
 */
export function makeSubmitter<
    Params = never,
    Data extends FormValues = never,
    EntryRule extends Rule = Rule,
    ImplementationParams = never,
>({
    capability,
}: {
    capability: CallableCapability<Params, Data, EntryRule, ImplementationParams>,
}): [
    (props: SubmitterProps<Params, Data, EntryRule, ImplementationParams>) => ReactNode,
    FieldOf<Data, SpecsOf<typeof kinds>>,
] {
    // One context for each call, so that the field made here reads the store of the submitter made here.
    const OwnStoreContext = createContext<FormStore | null>(null)

    return [Submitter, makeField(OwnStoreContext, kinds)]

    function Submitter(props: SubmitterProps<Params, Data, EntryRule, ImplementationParams>) {
        const {
            title,
            submitText = 'Opprett',
            submitColor = 'primary',
            confirmation,
            refreshOnSuccess,
            closePopUpOnSuccess,
            defaultValues,
            autosave,
            className,
            children,
        } = props
        const insideAnother = useContext(SubmitterContext) !== null
        const decided = useCapability(capability, props)
        const { refresh } = useSiteRouter()
        // A save the form makes by itself sends with what was given at the last render.
        const latest = useRef({ decided, refreshOnSuccess, refresh })
        useEffect(() => {
            latest.current = { decided, refreshOnSuccess, refresh }
        })
        const [store] = useState(() => createFormStore(
            values => (capability.data === undefined ? [] : checkValues(capability.data, values)),
            defaultValues,
            autosave ? { delayMs: AUTOSAVE_DELAY, save: values => saveItself(latest.current, values) } : undefined,
        ))
        const [submitterState] = useState(() => submitterStateOf(store))
        const submitState = useSyncExternalStore(store.subscribeToForm, store.submitState, store.submitState)
        const generalErrors = useSyncExternalStore(store.subscribeToForm, store.generalErrors, store.generalErrors)
        const popUp = useContext(PopUpContext)
        const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
        // What is still to happen after a save belongs to this form, and a pop-up may be opened again before it has.
        useEffect(() => {
            const pending = timers.current
            return () => pending.forEach(clearTimeout)
        }, [])
        // A form that is taken away with a change it has not saved saves it.
        useEffect(() => () => void store.saveUnsaved(), [store])

        if (insideAnother) {
            throw new Error('A submitter is inside another submitter. The browser submits a form inside a form '
                + 'itself, which reloads the page and loses every value, so render the two beside each other.')
        }
        if (!decided.authorized) return null

        const submit = async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (autosave) {
                void store.saveUnsaved()
                return
            }
            const values = store.startSubmit()
            if (values === undefined) return

            const result = await send(decided, values)
            if (!result.success) {
                store.refuse(issuesOf(result))
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
            <OwnStoreContext.Provider value={store}><SubmitterContext.Provider value={submitterState}>
                <form className={`
                    relative w-full
                    [&>h2]:mb-2
                    ${className ?? ''}
                `} onSubmit={submit}>
                    {title && <h2 className="text-base-content">{title}</h2>}
                    {children}
                    {autosave ? generalErrors.length > 0 && (
                        <p role="alert" className="mt-4 text-s text-error">{generalErrors[0].message}</p>
                    ) : (
                        <SubmitButton
                            color={submitColor}
                            confirmation={confirmation}
                            success={submitState === 'succeeded'}
                            pending={submitState === 'pending'}
                            generalErrors={generalErrors}
                        >
                            {submitText}
                        </SubmitButton>
                    )}
                </form>
            </SubmitterContext.Provider></OwnStoreContext.Provider>
        )
    }
}

type SubmitterProps<Params, Data, EntryRule extends Rule, ImplementationParams> =
    CapabilityInput<Params, EntryRule, ImplementationParams> & {
    title?: string,
    submitText?: string,
    submitColor?: Colors,
    confirmation?: Confirmation,
    refreshOnSuccess?: boolean,
    closePopUpOnSuccess?: PopUpKeyType,
    /** What the fields start as. They are read once, when the form is first rendered. */
    defaultValues?: Partial<Data>,
    /**
     * Saves a second after the last change, and at once when a field is left or the form is taken
     * away. It is read once, when the form is first rendered.
     */
    autosave?: boolean,
    className?: string,
    children?: ReactNode,
}

async function saveItself<Data>(
    { decided, refreshOnSuccess, refresh }: {
        decided: DecidedCapability<Data>,
        refreshOnSuccess?: boolean,
        refresh: () => void,
    },
    values: FormValues,
): Promise<ErrorMessage[]> {
    const result = await send(decided, values)
    if (!result.success) return issuesOf(result)
    if (refreshOnSuccess) refresh()
    return []
}

function issuesOf(refused: ActionError): ErrorMessage[] {
    return refused.error?.length ? refused.error : [{ message: GENERAL_ERROR }]
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
