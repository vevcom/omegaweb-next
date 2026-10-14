'use client'
import styles from './EditNews.module.scss'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import Textarea from '@/components/UI/Textarea'
import DateInput from '@/components/UI/DateInput'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import {
    destroyNewsAction,
    setNewsPublishedAction,
    updateNewsAction,
    updateNewsAdminLevelVisibilityAction,
    updateNewsRegularLevelVisibilityAction,
} from '@/services/news/actions'
import { formatVevenUri } from '@/lib/urlEncoding'
import { newsAuth } from '@/services/news/auth'
import { configureAction } from '@/services/configureAction'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { useRouter } from 'next/navigation'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'
import type { ExpandedNewsArticle } from '@/services/news/types'
import type { ReactNode } from 'react'

type PropTypes = {
    news: ExpandedNewsArticle
    doubleLevelVisibility: DoubleLevelVisibilityMatrix | null
    children?: ReactNode
}

/**
 * This component renders children if editmode is off and news admin tools if editmode is on
 * pass it not: id of article to make sure not to display that article
 */
export default function EditNews({ news, doubleLevelVisibility, children }: PropTypes) {
    const { refresh, push } = useRouter()

    const doubleLevelMatrix = doubleLevelVisibility ?? EMPTY_VISIBILITY
    const canUpdate = useEditMode({
        authorizer: newsAuth.update.data({ visibility: doubleLevelMatrix })
    })
    const canDestroy = useEditMode({
        authorizer: newsAuth.destroy.data({ visibility: doubleLevelMatrix })
    })
    const canUpdateRegularVisibility = useEditMode({
        authorizer: newsAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix })
    })
    const canUpdateAdminVisibility = useEditMode({
        authorizer: newsAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    })
    const canSetPublished = useEditMode({
        authorizer: newsAuth.setPublished.data({ visibility: doubleLevelMatrix })
    })

    // The editors are bound to doubleLevelVisibility rather than doubleLevelMatrix on purpose:
    // saving the fallback would overwrite the real requirements with fabricated ones.
    const canEditVisibility = doubleLevelVisibility !== null &&
        (canUpdateRegularVisibility || canUpdateAdminVisibility)
    if (!canUpdate && !canDestroy && !canEditVisibility && !canSetPublished) return children

    const updateAction = configureAction(
        updateNewsAction,
        { params: { id: news.id } }
    )

    const setPublishedAction = configureAction(
        setNewsPublishedAction,
        { params: { id: news.id } }
    )

    return (
        <div className={styles.EditNews}>
            <div className={styles.update}>
                {
                    canUpdate && (
                        <Form
                            action={updateAction}
                            navigateOnSuccess={(data) => `/news/${data ? formatVevenUri(data.articleName, data.id) : ''}`}
                            submitText="Oppdater"
                        >
                            <TextInput
                                color="white"
                                defaultValue={news.articleName}
                                label="Navn"
                                name="name"
                            />
                            <DateInput
                                color="white"
                                defaultValue={news.endDateTime}
                                label="Sluttdato"
                                name="endDateTime"
                            />
                            <Textarea defaultValue={news.description || ''} label="Beskrivelse" name="description" />
                        </Form>
                    )
                }
                {
                    canDestroy && (
                        <Form
                            action={
                                configureAction(
                                    destroyNewsAction,
                                    { params: { id: news.id } }
                                )
                            }
                            successCallback={() => {
                                push('/news')
                                refresh()
                            }}
                            submitText="Slett nyhet"
                            confirmation={{
                                confirm: true,
                                text: 'Er du sikker på at du vil slette denne nyheten? Dette kan ikke angres.'
                            }}
                            submitColor="red"
                        >
                        </Form>
                    )
                }
            </div>
            {
                doubleLevelVisibility && (
                    <div className={styles.visibility}>
                        {
                            canUpdateRegularVisibility && (
                                <div>
                                    <h3>Vanlig visning</h3>
                                    <VisibilityAdmin
                                        visibility={doubleLevelVisibility.regularLevel}
                                        visibilityId={news.visibilityRegularId}
                                        updateVisibilityAction={configureAction(
                                            updateNewsRegularLevelVisibilityAction,
                                            { implementationParams: { id: news.id } }
                                        )}
                                    />
                                </div>
                            )
                        }
                        {
                            canUpdateAdminVisibility && (
                                <div>
                                    <h3>Adminvisning</h3>
                                    <VisibilityAdmin
                                        visibility={doubleLevelVisibility.adminLevel}
                                        visibilityId={news.visibilityAdminId}
                                        updateVisibilityAction={configureAction(
                                            updateNewsAdminLevelVisibilityAction,
                                            { implementationParams: { id: news.id } }
                                        )}
                                    />
                                </div>
                            )
                        }
                    </div>
                )
            }

            <div className={styles.publish}>
                <p>{news.published ? 'Publisert' : 'Ikke publisert'}</p>
                {
                    canSetPublished && (
                        <Form
                            action={() => setPublishedAction({ data: { published: !news.published } })}
                            refreshOnSuccess
                            submitText={news.published ? 'Avpubliser' : 'Publiser'}
                            submitColor={news.published ? 'red' : 'green'}
                            confirmation={{
                                confirm: true,
                                text: news.published
                                    ? 'Er du sikker på at du vil avpublisere denne nyheten? ' +
                                        'Den vil da bare være synlig for de som kan administrere den.'
                                    : 'Er du sikker på at du vil publisere denne nyheten? ' +
                                        'Det sender ut et varsel til alle som kan se den.'
                            }}
                        />
                    )
                }
            </div>
        </div>
    )
}
