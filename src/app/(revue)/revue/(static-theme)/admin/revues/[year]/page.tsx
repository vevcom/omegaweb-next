import RevueAdminMetaForms from './RevueAdminMetaForms'
import RevueGroupsInRevueForms from './RevueGroupsInRevueForms'
import { revueLinks } from '@/app/(revue)/links'
import { revueAdminNavDef } from '@/app/(revue)/revue/(static-theme)/admin/revueAdminNavDef'
import yearFromParam from '@/app/(revue)/revue/[year]/yearFromParam'
import SiteLink from '@/components/SiteLink/SiteLink'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { revueAuth } from '@/services/revue/auth'
import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const sectionClassName = `
    flex flex-col gap-4 p-4 rounded-round bg-base-200
    [&>h2]:m-0 [&>h2]:text-l
`

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ year: string }>) => {
        await revueAdminNavDef.authorize('revues', session)
        const revue = await revueOperations.read({ params: { year: yearFromParam(params.year) } })
        const [groupsInRevue, groups] = await Promise.all([
            revueGroupOperations.readManyInRevue({ params: { revueId: revue.id } }),
            revueGroupOperations.readMany({}),
        ])
        return { revue, groupsInRevue, groups }
    },
    capabilities: () => ({
        canUpdate: revueAuth.update,
        canDestroy: revueAuth.destroy,
    }),
    metadata: ({ revue }) => ({ title: `Administrer ${revue.name}` }),
    render: ({ data: { revue, groupsInRevue, groups }, capabilities }) => (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
                <h1 className="m-0">{revue.name}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-base-content/80 text-s">
                    <span>{revue.year}</span>
                    <SiteLink href={revueLinks.revue(revue)}>Revyens side</SiteLink>
                </div>
            </header>

            <section className={sectionClassName}>
                <h2>Grupper i revyen</h2>
                <RevueGroupsInRevueForms
                    revueId={revue.id}
                    groupsInRevue={groupsInRevue}
                    groupsNotInRevue={groups
                        .filter(group => !groupsInRevue.some(inRevue => inRevue.id === group.id))
                        .flatMap(group => {
                            const own = (group.committee ?? group.revueSubGroup)?.group
                            return own ? [{ id: group.id, name: group.name, type: group.type, order: own.order }] : []
                        })}
                />
            </section>

            <section className={sectionClassName}>
                <RevueAdminMetaForms
                    revue={{
                        id: revue.id,
                        year: revue.year,
                        name: revue.name,
                        themeBackground: revue.themeBackground,
                        themePrimary: revue.themePrimary,
                        themeSecondary: revue.themeSecondary,
                        themeAccent: revue.themeAccent,
                    }}
                    capabilities={capabilitiesToJsObject(capabilities)}
                />
            </section>
        </div>
    ),
})

export default page
export { generateMetadata }
