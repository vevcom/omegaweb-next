'use client'
import styles from './ScreenPagesForm.module.scss'
import { updateScreenPagesAction } from '@/services/screens/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { ScreenPage } from '@/prisma-generated-pn-types'

type PageOption = Pick<ScreenPage, 'id' | 'name'>

/**
 * Chooses the pages a screen shows and their order. The chosen pages are submitted in order, one
 * hidden input each, which is the order the screen shows them in.
 */
export default function ScreenPagesForm({ screenId, shownPageIds, screenPages }: {
    screenId: number,
    shownPageIds: number[],
    screenPages: PageOption[],
}) {
    const [chosenIds, setChosenIds] = useState(shownPageIds)
    const pageById = new Map(screenPages.map(screenPage => [screenPage.id, screenPage]))
    const chosen = chosenIds.flatMap(id => pageById.get(id) ?? [])
    const notChosen = screenPages.filter(screenPage => !chosenIds.includes(screenPage.id))

    const move = (index: number, offset: number) => setChosenIds(ids => {
        const moved = [...ids]
        const [id] = moved.splice(index, 1)
        moved.splice(index + offset, 0, id)
        return moved
    })

    return <Form
        title="Sider på skjermen"
        action={configureAction(updateScreenPagesAction, { params: { id: screenId } })}
        submitText="Lagre sider"
        refreshOnSuccess
        closePopUpOnSuccess="screenSettings"
    >
        {chosen.length === 0 ? <p>Skjermen viser ingen sider.</p> : (
            <ol className={styles.pages}>
                {chosen.map((screenPage, index) => (
                    <li key={screenPage.id}>
                        <input type="hidden" name="pageIds" value={screenPage.id} />
                        <span>{screenPage.name}</span>
                        <button type="button" aria-label="Flytt opp" disabled={index === 0} onClick={() => move(index, -1)}>
                            <FontAwesomeIcon icon={faArrowUp} />
                        </button>
                        <button
                            type="button"
                            aria-label="Flytt ned"
                            disabled={index === chosen.length - 1}
                            onClick={() => move(index, 1)}
                        >
                            <FontAwesomeIcon icon={faArrowDown} />
                        </button>
                        <button
                            type="button"
                            aria-label="Fjern"
                            onClick={() => setChosenIds(ids => ids.filter(id => id !== screenPage.id))}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </li>
                ))}
            </ol>
        )}
        {notChosen.length > 0 && (
            <ul className={styles.pages}>
                {notChosen.map(screenPage => (
                    <li key={screenPage.id}>
                        <span>{screenPage.name}</span>
                        <button
                            type="button"
                            aria-label="Legg til"
                            onClick={() => setChosenIds(ids => [...ids, screenPage.id])}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                    </li>
                ))}
            </ul>
        )}
    </Form>
}
