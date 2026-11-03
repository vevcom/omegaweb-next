import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { createAdmissionTrialAction } from '@/services/admission/actions'
import {
    updateOmegaMembershipUserLevelAction,
    updateOmegaMembershipUserOrderAction,
} from '@/services/groups/omegaMembershipGroups/actions'
import { admissionAuth } from '@/services/admission/auth'
import { admissionOperations } from '@/services/admission/operations'
import { omegaMembershipGroupAuth } from '@/services/groups/omegaMembershipGroups/auth'
import { admissionDisplayNames, allAdmissions } from '@/services/admission/constants'
import { OMEGA_MEMBERSHIP_LEVEL_RANKING } from '@/services/groups/constants'
import { sexConfig } from '@/services/users/constants'
import { configureAction } from '@/services/configureAction'
import { serverPage, withFallback } from '@/app/ServerPage'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { OmegaMembershipLevel } from '@/prisma-generated-pn-types'

/**
 * What each step of the ladder is called on this page. Sysken is left out: what a member is called
 * depends on who they are, so it is resolved against the user's sex below.
 */
const stepNames = {
    DEN_GEMENE_HOB: 'Den gemene hob',
    SOELLE: 'Soelle',
} as const satisfies Partial<Record<OmegaMembershipLevel, string>>

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'membership-status', session)
        const userId = profile.user.id

        // Someone who may not read the trials still gets the page, without them.
        const trials = await withFallback(
            admissionOperations.readTrial({ params: { userId } }),
            [],
            ['UNAUTHORIZED', 'UNAUTHENTICATED']
        )

        return { profile, sittedTrials: trials.map(trial => trial.admission) }
    },
    capabilities: (data) => ({
        canReadTrials: admissionAuth.readTrial.data({ userId: data.profile.user.id }),
        canRegisterTrial: admissionAuth.createTrial,
        canChangeLevel: omegaMembershipGroupAuth.updateUserLevel,
        canChangeOrder: omegaMembershipGroupAuth.updateUserOrder,
    }),
    render: ({ data, capabilities }) => {
        const { profile } = data
        const { id: userId } = profile.user

        const currentLevel = profile.omegaMembership.level
        const sittedTrials = new Set(data.sittedTrials)

        // Only a soelle sits trials, so that is the only time registering one would be accepted.
        const showTrialRegistration = capabilities.canRegisterTrial.authorized && currentLevel === 'SOELLE'

        return (
            <div className="bg-surface-base rounded-round p-(--card-padding)">
                <h2>Medlemsstatus</h2>

                {/* Highest standing first, so the ladder is read from the top down. */}
                <ol className="flex flex-col gap-2 list-none mt-(--card-padding) mx-0 mb-0 p-0">
                    {[...OMEGA_MEMBERSHIP_LEVEL_RANKING].reverse().map(level => (
                        <li key={level} className="flex flex-col gap-2">
                            <div className={`
                                flex items-center justify-between gap-2 p-(--card-padding) border-2 rounded-round
                                ${level === currentLevel
                            ? 'border-accent-blue bg-surface-hover text-ink-strong font-bold'
                            : 'border-transparent bg-surface-raised text-text-muted'}
                            `}
                            >
                                <span>
                                    {level === 'SYSKEN'
                                        ? sexConfig[profile.user.sex ?? 'OTHER'].title
                                        : stepNames[level]}
                                </span>
                                {level === currentLevel
                                    ? <span className="
                                        text-[0.8rem] font-normal uppercase tracking-[0.05em] text-accent-blue
                                    ">Du er her</span>
                                    : capabilities.canChangeLevel.authorized && (
                                        <Form
                                            className="m-0! p-0! text-[0.8rem]!"
                                            submitText="Flytt hit"
                                            submitColor="secondary"
                                            refreshOnSuccess
                                            confirmation={{
                                                confirm: true,
                                                text: 'Er du sikker? Opptaksprøver nullstilles om brukeren ' +
                                                    'flyttes ned.',
                                            }}
                                            action={configureAction(updateOmegaMembershipUserLevelAction, {
                                                params: { userId, omegaMembershipLevel: level, onlyUpgrade: false },
                                            })}
                                        />
                                    )}
                            </div>

                            {/* The trials are what carries a soelle up to sysken, so they sit in the
                                gap between the two. Hidden from anyone who may not read them, since
                                empty boxes would read as "none sat" rather than "not shown". */}
                            {level === 'SYSKEN' && capabilities.canReadTrials.authorized && (
                                <ul className="flex flex-wrap gap-2 list-none m-0 py-0 px-(--card-padding)">
                                    {allAdmissions.map(admission => (
                                        <li
                                            key={admission}
                                            className={`
                                                flex flex-col items-center gap-2 flex-[1_1_0] min-w-[8rem]
                                                p-[calc(2*var(--rounding))] text-center border-2 rounded-round
                                                max-mobile:basis-full
                                                ${sittedTrials.has(admission)
                                            ? 'border-solid border-accent-green text-ink-strong'
                                            : 'border-dashed border-[#adb5bd] text-text-muted'}
                                            `}
                                        >
                                            <span>{admissionDisplayNames[admission]}</span>
                                            {showTrialRegistration && !sittedTrials.has(admission) && (
                                                <Form
                                                    className="m-0! p-0! text-[0.8rem]!"
                                                    submitText="Registrer"
                                                    submitColor="secondary"
                                                    refreshOnSuccess
                                                    action={configureAction(createAdmissionTrialAction, {
                                                        params: { admission },
                                                    })}
                                                >
                                                    <input type="hidden" name="userId" value={userId} />
                                                </Form>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ol>

                <section className="
                    mt-(--card-padding) pt-(--card-padding) border-t border-surface-hover
                    [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-2
                ">
                    <h3>Orden</h3>
                    <p>
                        Medlemskapet er uudaf den {profile.omegaMembership.order}´dis orden.
                    </p>
                    {capabilities.canChangeOrder.authorized && (
                        <Form
                            submitText="Endre orden"
                            refreshOnSuccess
                            action={configureAction(updateOmegaMembershipUserOrderAction, {
                                params: { userId },
                            })}
                        >
                            <NumberInput
                                name="order"
                                label="Orden"
                                defaultValue={profile.omegaMembership.order}
                                min={1}
                            />
                        </Form>
                    )}
                </section>
            </div>
        )
    },
})

export default page
export { generateMetadata }
