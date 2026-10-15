'use client'
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

const copySuccessColorClass = {
    red: 'text-accent-red',
    green: 'text-accent-green',
}

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

    const colorClass = copySuccess.color ? copySuccessColorClass[copySuccess.color] : ''

    return (
        <div className="min-w-[50vw] grid grid-cols-2">
            <Form
                title="Lag en ny nøkkel"
                action={createApiKeyAction}
                successCallback={data => showApiKey(data?.key)}
            >
                <TextInput name="name" label="Navn" />
            </Form>

            <div className="flex-[1_1_100%] flex flex-col h-full justify-start">
                <h3>Nøkkel</h3>
                <div className="flex items-center gap-[1em]">
                    {apiKeyToShow ? <p>{apiKeyToShow}</p> : <i>Generer en nøkkel først</i>}
                    {apiKeyToShow && (
                        <button
                            className={[
                                'bg-transparent border-none [&_svg]:text-text-muted',
                                '[&_svg]:w-[1.5em]! [&_svg]:h-[1.5em]!',
                            ].join(' ')}
                            onClick={copyAPIKeyToClipboard}
                        >
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                    )}
                </div>
                {
                    copySuccess && <p className={
                        `my-[.5em] mx-0 ${colorClass}`
                    }>
                        {copySuccess.message}
                    </p>
                }
            </div>

        </div>
    )
}
