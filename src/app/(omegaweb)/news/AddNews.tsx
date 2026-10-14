'use client'
import styles from './AddNews.module.scss'
import Textarea from '@/components/UI/Textarea'
import { createNewsAction } from '@/services/news/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { EditModeContext } from '@/contexts/EditMode'
import { formatVevenUri } from '@/lib/urlEncoding'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'
import type { ExpandedNewsArticle } from '@/services/news/types'

export default function AddNews() {
    const { push } = useRouter()
    const editModeCtx = useContext(EditModeContext)
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [regularRequirements, setRegularRequirements] = useState<VisibilityRequirement[]>([])

    const handleCreate = (data?: ExpandedNewsArticle) => {
        editModeCtx?.setEditMode(true)
        push(`/news/${data ? formatVevenUri(data.articleName, data.id) : ''}`)
    }

    return (
        <div className={styles.AddNews}>
            <Form
                action={createNewsAction}
                successCallback={handleCreate}
                submitText="Lag nyhet"
            >
                <TextInput label="Navn" name="name" />
                <Textarea label="Beskrivelse" name="description" />
                {/*
                  * The levels are collected here rather than after the fact: a news article created
                  * with an empty admin level would be administrable by anyone until it was narrowed.
                  */}
                <div className={styles.visibility}>
                    <h3>Hvem kan administrere nyheten?</h3>
                    <VisibilityMatrixEditor
                        requirements={adminRequirements}
                        onChange={setAdminRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityAdminRequirements"
                        value={JSON.stringify(adminRequirements)}
                    />
                    <h3>Hvem kan lese nyheten? (tomt betyr alle)</h3>
                    <VisibilityMatrixEditor
                        requirements={regularRequirements}
                        onChange={setRegularRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityRegularRequirements"
                        value={JSON.stringify(regularRequirements)}
                    />
                </div>
            </Form>
        </div>
    )
}
