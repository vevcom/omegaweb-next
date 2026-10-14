'use client'
import styles from './CreateOmbul.module.scss'
import OmbulCover from './OmbulCover'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import FileInput from '@/components/UI/FileInput'
import Textarea from '@/components/UI/Textarea'
import { createOmbulAction } from '@/services/ombul/actions'
import Form from '@/components/Form/Form'
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

    const handleCreate = async (ombul: Ombul | undefined) => {
        if (ombul) push(`/ombul/${ombul.year}/${ombul.name}`)
        refresh()
    }

    return (
        <div className={styles.CreateOmbul}>
            <h1>Lag ny ombul</h1>
            <Form
                action={createOmbulAction}
                submitText="Lag ombul"
                className={styles.form}
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
                    label="Ombul fil"
                    name="ombulFile"
                />
                <FileInput
                    color="primary"
                    label="Ombul cover"
                    name="ombulCoverImage"
                    onChange={handlePreviewChange.bind(null, 'pImage')}
                />
            </Form>
            <div className={styles.imgPreview}>
                <OmbulCover preview={preview} ombul={null} />
            </div>
        </div>

    )
}
