'use client'
import { SubmitterContext } from './submitterContext'
import SaveStatusIcon from '@/components/UI/SaveStatusIcon'
import { useContext, useSyncExternalStore } from 'react'

/** Where the form around it is in saving itself, as an icon in the top right corner of the form. */
export default function SaveStatus() {
    const submitter = useContext(SubmitterContext)
    if (!submitter) throw new Error('Form.SaveStatus is not inside a submitter.')
    const status = useSyncExternalStore(submitter.subscribe, submitter.saveStatus, submitter.saveStatus)

    return <SaveStatusIcon status={status} />
}
