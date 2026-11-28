import type { SaveStatus } from '@/components/UI/SaveStatusIcon'
import type { ErrorMessage } from '@/services/error'

const NO_ERRORS: ErrorMessage[] = []

/**
 * What one rendered submitter holds. A field subscribes to its own name, so setting the value of
 * one field notifies no other. `check` gives the issues that stand in the way of submitting the
 * values, and none when they may be submitted. `defaultValues` are what the fields start as.
 * With `autosave` the form saves itself, see `saveUnsaved`. A value is kept as what reads it, so
 * a field may give one that is costly to make, which is made only when it is read.
 */
export function createFormStore(
    check: (values: FormValues) => ErrorMessage[],
    defaultValues: FormValues = {},
    autosave?: Autosave,
) {
    const values = new Map<string, () => unknown>(
        Object.entries(defaultValues).map(([name, value]) => [name, () => value]),
    )
    const mountCounts = new Map<string, number>()
    const fieldErrors = new Map<string, ErrorMessage[]>()
    const fieldListeners = new Map<string, Set<Listener>>()
    const changed = new Set<string>()
    const formListeners = new Set<Listener>()
    let generalErrors = NO_ERRORS
    let submitState: SubmitState = 'idle'
    // After a refused submit the form is checked as its values change, so an error goes when it is put right.
    let refused = false
    let saveStatus: SaveStatus = 'untouched'
    // Counts the changes, so an answer to a save of older values does not speak for newer ones.
    let changes = 0
    let saving = false
    // What was asked to be saved while a save was under way, read then, since its fields may be gone when it answers.
    let queued: { values: FormValues, changes: number } | undefined
    let saveTimer: ReturnType<typeof setTimeout> | undefined

    return {
        /** Returns what unmounts the field. A field with no value yet starts as `emptyValue`. */
        mount: (name: string, emptyValue: unknown) => {
            mountCounts.set(name, (mountCounts.get(name) ?? 0) + 1)
            if (readValue(name) === undefined) {
                writeValue(name, () => emptyValue)
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
            writeValue(name, () => value)
            notifyField(name)
            change(name)
        },

        /** Sets a value that is made only when the form reads it, such as the markdown of an editor. */
        setReader: (name: string, read: () => unknown) => {
            writeValue(name, read)
            change(name)
        },

        /**
         * Checks a field that is left, once its value has been set, so that passing an untouched
         * field says nothing. After a refused submit every change has already checked it. A form
         * that saves itself saves at once.
         */
        leave: (name: string) => {
            if (autosave) void saveUnsaved()
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

        saveStatus: () => saveStatus,

        saveUnsaved,

        /** Notified when the state of the submit or the save changes, or the errors that belong to no field. */
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

    function change(name: string) {
        changed.add(name)
        if (refused) showIssues(check(submittedValues()))
        if (!autosave) return
        changes += 1
        // The timer, or a leave, reads the newer values when it saves.
        queued = undefined
        setSaveStatus('unsaved')
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => void saveUnsaved(), autosave.delayMs)
    }

    /**
     * Saves the values of a form that saves itself, when there is a change it has not saved or a
     * save that failed. One save is under way at a time. Asked while one is, it reads the values
     * then, and sends them once that save has answered, unless a later change has replaced them.
     * A failed save is tried again by the next change or leave, and by nothing else.
     */
    async function saveUnsaved() {
        clearTimeout(saveTimer)
        if (!autosave || (saveStatus !== 'unsaved' && saveStatus !== 'failed')) return
        if (saving) {
            queued = { values: submittedValues(), changes }
            return
        }
        await save(autosave.save, submittedValues(), changes)
    }

    async function save(send: Autosave['save'], submitted: FormValues, savedChanges: number) {
        const issues = check(submitted)
        if (issues.length > 0) {
            refused = true
            showIssues(issues)
            setSaveStatus('failed')
            return
        }

        saving = true
        showIssues([])
        setSaveStatus('saving')
        let refusal: ErrorMessage[]
        try {
            refusal = await send(submitted)
        } finally {
            saving = false
        }
        if (changes !== savedChanges) {
            setSaveStatus('unsaved')
            const next = queued
            queued = undefined
            if (next) await save(send, next.values, next.changes)
            return
        }
        refused = refusal.length > 0
        showIssues(refusal)
        setSaveStatus(refused ? 'failed' : 'saved')
    }

    // The one place a value is read and written by its name, which is a top-level key.
    function readValue(name: string) {
        return values.get(name)?.()
    }

    function writeValue(name: string, read: () => unknown) {
        values.set(name, read)
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

    function setSaveStatus(status: SaveStatus) {
        if (saveStatus === status) return
        saveStatus = status
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

/** How a form saves itself: a moment after the last change, by sending its values to `save`. */
export type Autosave = {
    delayMs: number,
    /** Gives the issues that refused the values, and none when they were saved. */
    save: (values: FormValues) => Promise<ErrorMessage[]>,
}

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
