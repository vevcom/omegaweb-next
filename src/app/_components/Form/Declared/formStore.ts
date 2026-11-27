import type { ErrorMessage } from '@/services/error'

const NO_ERRORS: ErrorMessage[] = []

/**
 * What one rendered submitter holds. A field subscribes to its own name, so setting the value of
 * one field notifies no other. `check` gives the issues that stand in the way of submitting the
 * values, and none when they may be submitted. `defaultValues` are what the fields start as.
 */
export function createFormStore(check: (values: FormValues) => ErrorMessage[], defaultValues: FormValues = {}) {
    const values = new Map<string, unknown>(Object.entries(defaultValues))
    const mountCounts = new Map<string, number>()
    const fieldErrors = new Map<string, ErrorMessage[]>()
    const fieldListeners = new Map<string, Set<Listener>>()
    const changed = new Set<string>()
    const formListeners = new Set<Listener>()
    let generalErrors = NO_ERRORS
    let submitState: SubmitState = 'idle'
    // After a refused submit the form is checked as its values change, so an error goes when it is put right.
    let refused = false

    return {
        /** Returns what unmounts the field. A field with no value yet starts as `emptyValue`. */
        mount: (name: string, emptyValue: unknown) => {
            mountCounts.set(name, (mountCounts.get(name) ?? 0) + 1)
            if (readValue(name) === undefined) {
                writeValue(name, emptyValue)
                notifyField(name)
            }
            return () => {
                const count = mountCounts.get(name) ?? 0
                if (count > 1) mountCounts.set(name, count - 1)
                else mountCounts.delete(name)
            }
        },

        value: readValue,

        setValue: (name: string, value: unknown) => {
            writeValue(name, value)
            changed.add(name)
            notifyField(name)
            if (refused) showIssues(check(submittedValues()))
        },

        /**
         * Checks a field that is left, once its value has been set, so that passing an untouched
         * field says nothing. After a refused submit every change has already checked it.
         */
        leave: (name: string) => {
            if (refused || !changed.has(name)) return
            setFieldErrors(name, check(submittedValues()).filter(issue => fieldNameOf(issue) === name))
        },

        errors: (name: string) => fieldErrors.get(name) ?? NO_ERRORS,

        subscribeToField: (name: string, listener: Listener) => {
            const listeners = fieldListeners.get(name) ?? new Set<Listener>()
            fieldListeners.set(name, listeners)
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },

        generalErrors: () => generalErrors,

        submitState: () => submitState,

        /** Notified when the state of the submit changes, or the errors that belong to no field. */
        subscribeToForm: (listener: Listener) => {
            formListeners.add(listener)
            return () => {
                formListeners.delete(listener)
            }
        },

        /**
         * Gives the values to submit and marks the submit as under way. Gives nothing while one is
         * under way or its success still shows, so that a second click cannot save the same twice,
         * or when the values are refused, whose issues are then shown.
         */
        startSubmit: (): FormValues | undefined => {
            if (submitState !== 'idle') return undefined
            const submitted = submittedValues()
            const issues = check(submitted)
            if (issues.length > 0) {
                refuse(issues)
                return undefined
            }
            showIssues([])
            setSubmitState('pending')
            return submitted
        },

        refuse,

        succeed: () => {
            refused = false
            setSubmitState('succeeded')
        },

        clearSuccess: () => {
            if (submitState === 'succeeded') setSubmitState('idle')
        },
    }

    // The one place a value is read and written by its name, which is a top-level key.
    function readValue(name: string) {
        return values.get(name)
    }

    function writeValue(name: string, value: unknown) {
        values.set(name, value)
    }

    function submittedValues(): FormValues {
        return Object.fromEntries(Array.from(mountCounts.keys(), name => [name, readValue(name)]))
    }

    function refuse(issues: ErrorMessage[]) {
        refused = true
        showIssues(issues)
        setSubmitState('idle')
    }

    /** Each issue lands at the mounted field it names, and with the general ones when it names none such. */
    function showIssues(issues: ErrorMessage[]) {
        const byField = new Map<string, ErrorMessage[]>()
        const general: ErrorMessage[] = []
        issues.forEach(issue => {
            const name = fieldNameOf(issue)
            if (name === undefined || !mountCounts.has(name)) general.push(issue)
            else byField.set(name, [...(byField.get(name) ?? []), issue])
        })

        const named = Array.from(fieldErrors.keys()).concat(Array.from(byField.keys()))
        named.forEach(name => setFieldErrors(name, byField.get(name) ?? NO_ERRORS))
        if (sameIssues(generalErrors, general)) return
        generalErrors = general
        notifyForm()
    }

    // Errors that say the same keep their array, so what shows them is not rendered again.
    function setFieldErrors(name: string, errors: ErrorMessage[]) {
        if (sameIssues(fieldErrors.get(name) ?? NO_ERRORS, errors)) return
        if (errors.length > 0) fieldErrors.set(name, errors)
        else fieldErrors.delete(name)
        notifyField(name)
    }

    function setSubmitState(state: SubmitState) {
        if (submitState === state) return
        submitState = state
        notifyForm()
    }

    function notifyField(name: string) {
        fieldListeners.get(name)?.forEach(listener => listener())
    }

    function notifyForm() {
        formListeners.forEach(listener => listener())
    }
}

export type FormValues = Record<string, unknown>

export type FormStore = ReturnType<typeof createFormStore>

type SubmitState = 'idle' | 'pending' | 'succeeded'

type Listener = () => void

function fieldNameOf(issue: ErrorMessage) {
    const name = issue.path?.[0]
    return typeof name === 'string' ? name : undefined
}

function sameIssues(left: ErrorMessage[], right: ErrorMessage[]) {
    return left.length === right.length && left.every((issue, index) => (
        issue.message === right[index].message && issue.path?.join('.') === right[index].path?.join('.')
    ))
}
