import AddTeamDepartment from './AddTeamDepartment'
import AddTeamPerson from './AddTeamPerson'
import TeamDepartmentEditor from './TeamDepartmentEditor'
import {
    badgeClassName,
    bandClassName,
    innerClassName,
    sectionHeadingClassName,
} from '@/app/(careers)/_lib/careersClassNames'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import CmsPerson from '@/components/Cms/CmsPerson/CmsPerson'
import SpecialCmsImage from '@/components/Cms/CmsImage/SpecialCmsImage'
import { careersTeamOperations } from '@/services/careers/team/operations'
import { careersTeamAuth } from '@/services/careers/team/auth'
import {
    destroyCareersTeamPersonAction,
    moveCareersTeamPersonAction,
    updateCareersTeamDepartmentParagraphAction,
    updateCareersTeamPersonAction,
    updateCareersTeamPersonImageAction,
} from '@/services/careers/team/actions'
import { careersFrontpageAuth } from '@/services/careers/frontpage/auth'
import {
    readCareersFrontpageSpecialCmsImageAction,
    updateCareersFrontpageSpecialCmsImageAction,
} from '@/services/careers/frontpage/actions'
import { serverPage } from '@/app/ServerPage'

const departmentAnchor = (departmentId: number) => `avdeling-${departmentId}`

/** The career site's "about us" page: the team, grouped into departments. */
const { page, generateMetadata } = serverPage({
    operation: () => careersTeamOperations.readDepartments({}),
    capabilities: () => ({
        canEditDepartmentParagraph: careersTeamAuth.updateDepartmentParagraph,
        canEditPerson: careersTeamAuth.updatePerson,
        canEditSpecialCmsImage: careersFrontpageAuth.updateSpecialCmsImage,
    }),
    metadata: () => ({
        title: 'Om oss',
        description: 'Møt teamet bak Contactor NTNU, studentene som jobber med bedriftskontakt, '
            + 'rekruttering og karrierearrangementer.',
    }),
    render: ({ data: departments, capabilities }) => (
        <div className="flex flex-col">
            <section className={`
                ${bandClassName}
                relative overflow-hidden bg-careers-navy
            `}>
                <div className="
                    [--image-width:100%] h-[clamp(16rem,40vw,30rem)]
                    [&>div]:block [&>div]:size-full
                    [&_img]:size-full [&_img]:object-cover
                ">
                    <SpecialCmsImage
                        special="CAREER_ABOUT"
                        width={1600}
                        hideCredit
                        capabilities={{ canEdit: capabilities.canEditSpecialCmsImage }}
                        readSpecialCmsImageAction={readCareersFrontpageSpecialCmsImageAction}
                        updateCmsImageAction={updateCareersFrontpageSpecialCmsImageAction}
                    />
                </div>
                <div className="
                    absolute inset-0 pointer-events-none bg-linear-to-t from-careers-navy/85 via-careers-navy/30
                    to-transparent
                " />
                <div className={`
                    ${innerClassName}
                    absolute inset-x-0 bottom-0 pb-10 pointer-events-none
                `}>
                    <span className={`
                        ${badgeClassName}
                        mb-3! text-white/70
                    `}>Menneskene bak</span>
                    <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] text-white">Teamet vårt</h1>
                </div>
            </section>

            {departments.length > 0 && (
                <nav className="flex gap-8 py-6 overflow-x-auto border-b border-careers-line">
                    {departments.map(department => (
                        <a
                            key={department.id}
                            href={`#${departmentAnchor(department.id)}`}
                            className="
                                text-s font-semibold tracking-[0.1em] uppercase whitespace-nowrap text-text-muted
                                transition-colors
                                hover:text-careers-accent hover:no-underline
                            "
                        >
                            {department.name}
                        </a>
                    ))}
                </nav>
            )}

            <div className="flex flex-col gap-24 py-20">
                {departments.map((department, departmentIndex) => (
                    <section
                        key={department.id}
                        id={departmentAnchor(department.id)}
                        className="
                            scroll-mt-24
                            max-mobile:scroll-mt-52
                        "
                    >
                        <div className="
                            grid grid-cols-[1fr_2fr] gap-8 mb-10
                            max-mobile:grid-cols-1
                        ">
                            <div>
                                <h2 className={`
                                    ${sectionHeadingClassName}
                                    text-careers-navy
                                `}>{department.name}</h2>
                                <TeamDepartmentEditor
                                    department={{
                                        id: department.id,
                                        name: department.name,
                                        personCount: department.persons.length,
                                    }}
                                    canMoveUp={departmentIndex > 0}
                                    canMoveDown={departmentIndex < departments.length - 1}
                                />
                            </div>
                            <CmsParagraph
                                cmsParagraph={department.paragraph}
                                className="
                                    mb-0!
                                    [&_:is(p,li)]:text-m [&_:is(p,li)]:leading-[1.7]
                                "
                                updateCmsParagraphAction={updateCareersTeamDepartmentParagraphAction}
                                capabilities={{ canEdit: capabilities.canEditDepartmentParagraph }}
                            />
                        </div>
                        <div className="
                            grid grid-cols-4 gap-x-5 gap-y-10
                            max-mobile:grid-cols-2
                        ">
                            {department.persons.map((person, personIndex) => (
                                <CmsPerson
                                    key={person.id}
                                    cmsPerson={person}
                                    canMoveBack={personIndex > 0}
                                    canMoveForward={personIndex < department.persons.length - 1}
                                    updateCmsPersonAction={updateCareersTeamPersonAction}
                                    moveCmsPersonAction={moveCareersTeamPersonAction}
                                    destroyCmsPersonAction={destroyCareersTeamPersonAction}
                                    updateCmsPersonImageAction={updateCareersTeamPersonImageAction}
                                    capabilities={{ canEdit: capabilities.canEditPerson }}
                                />
                            ))}
                            <AddTeamPerson departmentId={department.id} />
                        </div>
                    </section>
                ))}
                <AddTeamDepartment />
            </div>
        </div>
    ),
})

export default page
export { generateMetadata }
