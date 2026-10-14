'use client'
import styles from './CreateApiKeyForm.module.scss'
import Form from '@/components/Form/Form'
import { createApiKeyAction } from '@/services/apiKeys/actions'
import TextInput from '@/components/UI/TextInput'
import { PopUpContext } from '@/contexts/PopUp'
import { useContext, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import type { PopUpKeyType } from '@/contexts/PopUp'

type Color = 'red' | 'green' | null

type PropTypes = {
    popUpKey: PopUpKeyType
}

/**
 * Component for creating a new API key
 * @param popUpKey - Used to know the popUp to use after the form is submitted and the key has displayed
 * @returns
 */
export default function CreateApiKeyForm({ popUpKey }: PropTypes) {
    const [apiKeyToShow, setApiKeyToShow] = useState<string | null>(null)
    const [copySuccess, setCopySuccess_] = useState<{
        color: Color
        message: string | null
    }>({ color: null, message: null })
    const popUpContext = useContext(PopUpContext)
    const { refresh } = useRouter()

    const setCopySuccess = (message: string | null, color: Color) => {
        setCopySuccess_({
            color,
            message,
        })
        setTimeout(() => setCopySuccess_({ message: null, color: null }), 5_000)
    }

    const showApiKey = (key: string | undefined) => {
        setApiKeyToShow(key ?? null)
        setTimeout(() => {
            setApiKeyToShow(null)
            popUpContext?.remove(popUpKey)
            refresh()
        }, 20_000)
    }

    const copyAPIKeyToClipboard = () => {
        if (!apiKeyToShow) return setCopySuccess('Ingen nøkkel å kopiere', 'red')
        return navigator.clipboard.writeText(apiKeyToShow).then(
            () => setCopySuccess('Kopiert!', 'green')
        ).catch(
            () => setCopySuccess('Kunne ikke kopiere nøkkel', 'red')
        )
    }

    const colorClass = copySuccess.color ? styles[copySuccess.color] : ''

    return (
        <div className={styles.CreateApiKeyForm}>
            <Form
                title="Lag en ny nøkkel"
                action={createApiKeyAction}
                className={styles.form}
                successCallback={data => showApiKey(data?.key)}
            >
                <TextInput name="name" label="Navn" />
            </Form>

            <div className={styles.keyHolder}>
                <h3>Nøkkel</h3>
                <div className={styles.keyAndCopy}>
                    {apiKeyToShow ? <p className={styles.ApiKey}>{apiKeyToShow}</p> : <i>Generer en nøkkel først</i>}
                    {apiKeyToShow && (
                        <button className={styles.copy} onClick={copyAPIKeyToClipboard}>
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                    )}
                </div>
                {
                    copySuccess && <p className={
                        `${styles.copySuccess} ${colorClass}`
                    }>
                        {copySuccess.message}
                    </p>
                }
            </div>

        </div>
    )
}
