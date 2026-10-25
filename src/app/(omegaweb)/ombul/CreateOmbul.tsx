'use client'
import OmbulCover from './OmbulCover'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import FileInput from '@/components/UI/FileInput'
import Textarea from '@/components/UI/Textarea'
import { createOmbulAction } from '@/services/ombul/actions'
import Form from '@/components/Form/Form'
import { formatVevenUri } from '@/lib/urlEncoding'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Ombul } from '@/prisma-generated-pn-types'
import type { PropTypesPreview } from './OmbulCover'
import type { ChangeEvent } from 'react'

type PropTypes = {
    latestOmbul: Ombul | null
}

type PreviewKey = keyof PropTypesPreview

/**
 * This component is for creating ombul issues.
 * @param latestOmbul - The latest ombul issue, used to set default values for year and issueNumber of next ombul
 */
export default function CreateOmbul({ latestOmbul }: PropTypes) {
    const { refresh, push } = useRouter()
    const currentYear = new Date().getFullYear()

    let nextYear: number
    let nextIssue: number
    if (!latestOmbul) {
        nextYear = currentYear
        nextIssue = 1
    } else if (currentYear === latestOmbul?.year) {
        nextYear = currentYear
        nextIssue = latestOmbul.issueNumber + 1
    } else {
        nextYear = currentYear
        nextIssue = 1
    }

    const [preview, setPreview] = useState<PropTypesPreview>({
        pImage: new File([], 'cover'),
        pName: '',
        pYear: nextYear.toString(),
        pIssueNumber: nextIssue.toString(),
        pDescription: ''
    })

    const handlePreviewChange = (
        type: PreviewKey,
        event: ChangeEvent<HTMLInputElement>
    ) => {
        if (type === 'pImage') {
            const files = event.target.files
            if (files) {
                setPreview({
                    ...preview,
                    pImage: files[0],
                })
            }
        } else {
            setPreview({
                ...preview,
                [type]: event.target.value,
            })
        }
    }

    const handlePreviewChangeDescription = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setPreview({
            ...preview,
            pDescription: event.target.value,
        })
    }

    const handleCreate = (ombul: Ombul | undefined) => {
        if (ombul) push(`/ombul/${ombul.year}/${formatVevenUri(ombul.name, ombul.id)}`)
        refresh()
    }

    return (
        <div className="
            min-w-[60vw] grid grid-cols-[1fr_1fr] grid-rows-[auto_auto] gap-10
            max-mobile:grid-cols-1
        ">
            <h1 className="col-[1/3] row-[1/2]">Lag ny ombul</h1>
            <Form
                action={createOmbulAction}
                submitText="Lag ombul"
                className="
                    col-[1/2] min-w-[30vw]
                    [&_textarea]:min-h-[100px]
                "
                successCallback={handleCreate}
            >
                <TextInput
                    label="Navn"
                    name="name"
                    onChange={handlePreviewChange.bind(null, 'pName')}
                />
                <Textarea
                    label="Beskrivelse"
                    name="description"
                    onChange={handlePreviewChangeDescription}
                />
                <NumberInput
                    label="År"
                    name="year"
                    defaultValue={nextYear}
                    onChange={handlePreviewChange.bind(null, 'pYear')}
                />
                <NumberInput
                    label="Nummer"
                    name="issueNumber"
                    defaultValue={nextIssue}
                    onChange={handlePreviewChange.bind(null, 'pIssueNumber')}
                />
                <FileInput
                    color="primary"
                    label="Ombul-fil"
                    name="ombulFile"
                />
                <FileInput
                    color="primary"
                    label="Forsidebilde"
                    name="ombulCoverImage"
                    onChange={handlePreviewChange.bind(null, 'pImage')}
                />
            </Form>
            <div className="
                col-[2/3] ml-4 w-[70%] h-[70%] min-w-[20vw] max-w-[30vw]
                max-mobile:hidden
                [&_img]:w-[70%]! [&_img]:h-full [&_img]:object-contain! [&_img]:mb-2
            ">
                <OmbulCover preview={preview} ombul={null} />
            </div>
        </div>

    )
}
