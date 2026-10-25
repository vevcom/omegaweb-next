'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import { changeClassOfUserAction } from '@/services/groups/classes/actions'
import { CLASS_LEVEL_ORDERING, ClassLevelConfig } from '@/services/groups/constants'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { ClassLevel } from '@/prisma-generated-pn-types'

type PropTypes = {
    userId: number,
    /**
     * The class the user is in now, or null when they have not been placed in one. It is only the
     * starting point of the select - the service decides what changing it means.
     */
    currentLevel: ClassLevel | null,
}

/**
 * Moves a user into a class. The class is set for the order the class groups are in - the current
 * one - and the memberships the user held before are kept, inactive, as the record of which class
 * they were in then.
 */
export default function ChangeClassForm({ userId, currentLevel }: PropTypes) {
    const [level, setLevel] = useState<ClassLevel>(currentLevel ?? CLASS_LEVEL_ORDERING[0])

    return (
        <Form
            title="Klasse"
            submitText={currentLevel ? 'Endre klasse' : 'Sett klasse'}
            action={configureAction(changeClassOfUserAction, { params: { userId } })}
            refreshOnSuccess
            confirmation={{
                confirm: true,
                text: `Sette brukeren i ${ClassLevelConfig[level].name}? `
                    + 'Klassen brukeren står i nå blir stående som historikk.',
            }}
        >
            <SelectString
                name="level"
                label="Klasse"
                value={level}
                onChange={value => {
                    const chosen = CLASS_LEVEL_ORDERING.find(candidate => candidate === value)
                    if (chosen) setLevel(chosen)
                }}
                options={CLASS_LEVEL_ORDERING.map(option => ({
                    value: option,
                    label: ClassLevelConfig[option].name,
                    key: option,
                }))}
            />
        </Form>
    )
}
