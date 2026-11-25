'use client'
import { describeVisibility } from './describeVisibility'
import VisibilityAdmin from './VisibilityAdmin/VisibilityAdmin'
import VisibilityMatrixEditor from './VisibilityMatrixEditor/VisibilityMatrixEditor'
import useAuthorizer from '@/hooks/useAuthorizer'
import useFlatGroups from '@/hooks/useFlatGroups'
import type { DefaultMembershipRequirements } from './pickedGroups'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { ExpandedGroup } from '@/services/groups/types'
import type {
    DoubleLevelVisibilityMatrix,
    UpdateVisibilityAction,
    VisibilityMatrix,
    VisibilityRequirement,
} from '@/services/visibility/types'

export type VisibilityComponentsConfig<Params> = {
    /** Ends the sentence saying who passes, such as "kan lese nyheten". */
    verb: string,
    /** What no requirements means. Left out where that must not be offered, as for those administrating. */
    everyone?: string,
    /**
     * What a group picked in the editor starts as, by its type: `regularDefaultMembershipRequirements` for
     * a visibility of who sees or signs up, and `adminDefaultMembershipRequirements` otherwise.
     */
    defaultMembershipRequirements: DefaultMembershipRequirements,
    /** The owner's action for changing the visibility, with what names the owner bound, such as its id. */
    update?: (params: Params) => UpdateVisibilityAction,
}

type FieldProps = {
    /** The form field the requirements are posted in, as JSON. */
    name: string,
    defaultValue?: VisibilityRequirement[],
} | {
    /** For a form that needs the requirements as they are edited, and posts them itself. */
    requirements: VisibilityRequirement[],
    onChange: (requirements: VisibilityRequirement[]) => void,
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The components of one visibility an owner has, with its wording and its update action bound, so
 * that the form that creates the owner, the one that changes it and the text describing it cannot
 * say different things. The frontend's counterpart of `implementVisibilityOperations`: an owner
 * calls it once, in a file of its own beside its pages, and its components import the result.
 *
 * `Field` is the editor as a field of another form. `Form` saves the visibility on its own, and takes
 * `update`. `Description` and `describe` say who passes, and `heading` asks it.
 */
export function implementVisibilityComponents<Params = never>(
    { verb, everyone, defaultMembershipRequirements, update }: VisibilityComponentsConfig<Params>,
) {
    const describe = (visibility: VisibilityMatrix, groups: ExpandedGroup[] | null) => (
        describeVisibility(visibility, groups, { everyone })
    )

    function Field(props: FieldProps) {
        return <VisibilityMatrixEditor
            {...props}
            verb={verb}
            everyone={everyone}
            defaultMembershipRequirements={defaultMembershipRequirements}
        />
    }

    function Form({ visibility, visibilityId, params }: {
        visibility: VisibilityMatrix,
        visibilityId: number,
        params: Params,
    }) {
        if (!update) throw new Error(`The visibility of who ${verb} has no update action to save with.`)
        return <VisibilityAdmin
            visibility={visibility}
            visibilityId={visibilityId}
            updateVisibilityAction={update(params)}
            verb={verb}
            everyone={everyone}
            defaultMembershipRequirements={defaultMembershipRequirements}
        />
    }

    function Description({ visibility }: { visibility: VisibilityMatrix }) {
        return describe(visibility, useFlatGroups())
    }

    return { Field, Form, Description, describe, heading: `Hvem ${verb}?`, label: capitalized(verb) } as const
}

type LevelConfig<Params> = VisibilityComponentsConfig<Params> & {
    /** Who may change this level, which decides whether `Forms` shows its form. */
    updateAuthorizer: (doubleLevelVisibility: DoubleLevelVisibilityMatrix) => Authorizer,
}

/**
 * The components of an owner's double level visibility: `regular` and `admin` are each what
 * `implementVisibilityComponents` gives. `Forms` is both levels to change, each shown to those who
 * may change it, and `Description` both in words.
 */
export function implementDoubleLevelVisibilityComponents<Params = never>({ regular, admin }: {
    regular: LevelConfig<Params>,
    admin: LevelConfig<Params>,
}) {
    const levels = {
        regular: implementVisibilityComponents(regular),
        admin: implementVisibilityComponents(admin),
    }

    function Forms({ doubleLevelVisibility, visibilityIds, params }: {
        doubleLevelVisibility: DoubleLevelVisibilityMatrix,
        visibilityIds: { regular: number, admin: number },
        params: Params,
    }) {
        const canUpdate = {
            regular: useAuthorizer({ authorizer: regular.updateAuthorizer(doubleLevelVisibility) }).authorized,
            admin: useAuthorizer({ authorizer: admin.updateAuthorizer(doubleLevelVisibility) }).authorized,
        }
        return <>
            {canUpdate.regular && <div className="flex flex-col gap-2">
                <h3 className="m-0">{levels.regular.heading}</h3>
                <levels.regular.Form
                    visibility={doubleLevelVisibility.regularLevel}
                    visibilityId={visibilityIds.regular}
                    params={params}
                />
            </div>}
            {canUpdate.admin && <div className="flex flex-col gap-2">
                <h3 className="m-0">{levels.admin.heading}</h3>
                <levels.admin.Form
                    visibility={doubleLevelVisibility.adminLevel}
                    visibilityId={visibilityIds.admin}
                    params={params}
                />
            </div>}
        </>
    }

    function Description({ doubleLevelVisibility }: { doubleLevelVisibility: DoubleLevelVisibilityMatrix }) {
        const groups = useFlatGroups()
        return <p className="flex flex-col gap-[0.2em] mt-[0.5em] text-s opacity-85">
            <span>{levels.regular.label}: {levels.regular.describe(doubleLevelVisibility.regularLevel, groups)}</span>
            <span>{levels.admin.label}: {levels.admin.describe(doubleLevelVisibility.adminLevel, groups)}</span>
        </p>
    }

    return { ...levels, Forms, Description } as const
}
