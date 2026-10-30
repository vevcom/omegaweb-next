import { careersTeamOperations } from '@/services/careers/team/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const departments = [
    {
        name: 'Ledelse',
        description: 'Ledelsen har overordnet ansvar for at Contactor blir driftet i tråd med Contactor og Omegas '
            + 'mål. Dette innebærer å ha kontroll på avtaler, drift og prosjekter, samt hvilke '
            + 'bedriftspresentasjoner som er planlagt.',
        titles: ['Leder', 'Nestleder'],
    },
    {
        name: 'Bedrift',
        description: 'Bedrift opprettholder kontakt med nye og eksisterende bedrifter og utvider '
            + 'bedriftsporteføljen. Gruppen planlegger og organiserer arrangementer sammen med bedrifter, som '
            + 'bedriftspresentasjoner, kurs og temauker.',
        titles: ['Leder Bedrift', 'Bedrift', 'Bedrift'],
    },
    {
        name: 'PR',
        description: 'PR står for promotering av Contactors arrangementer til studentene i Omega gjennom sosiale '
            + 'medier, e-post og andre kanaler. Gruppen analyserer og presenterer også statistikk over hvor '
            + 'fornøyde studentene er med Contactors arbeid.',
        titles: ['Leder PR', 'PR'],
    },
    {
        name: 'Økonomi',
        description: 'Økonomi fakturerer bedrifter for bedriftspresentasjoner og stillingsannonser, lager budsjett '
            + 'for kommende regnskapsår og fører regnskap for foregående år.',
        titles: ['Leder Økonomi', 'Økonomi'],
    },
    {
        name: 'IT',
        description: 'IT drifter og vedlikeholder nettsiden til Contactor, sørger for at den er oppdatert og '
            + 'implementerer nye tekniske løsninger.',
        titles: ['Leder IT', 'IT'],
    },
    {
        name: 'Spons',
        description: 'Spons skaffer sponsormidler til Contactor utover det som genereres gjennom '
            + 'bedriftspresentasjoner. Arbeidet handler om å finne aktuelle bedrifter og kontakte dem om spons.',
        titles: ['Leder Spons', 'Spons'],
    },
    {
        name: 'Kommunikasjon',
        description: 'Kommunikasjon behandler alle e-poster sendt til Contactors postboks og legger ut '
            + 'stillingsannonser for bedrifter på Omega sin nettside.',
        titles: ['Leder Kommunikasjon', 'Kommunikasjon'],
    },
]

export const seedDevCareersTeam = defineSeedOperation(async (prisma: PrismaClient) => {
    for (const department of departments) {
        await upsert({
            checkExistence: () => prisma.careerTeamDepartment.findFirst({
                where: { name: department.name },
                select: { id: true },
            }),
            create: async () => {
                const created = await careersTeamOperations.createDepartment({ data: { name: department.name } })
                await careersTeamOperations.updateDepartmentParagraph({
                    params: { paragraphId: created.paragraphId },
                    data: { markdown: department.description },
                })
                for (let index = 0; index < department.titles.length; index++) {
                    const title = department.titles[index]
                    await careersTeamOperations.createPerson({
                        implementationParams: { departmentId: created.id },
                        data: {
                            name: `${department.name} ${index + 1}`,
                            title,
                            email: `${department.name.toLowerCase().replace('ø', 'o')}${index + 1}@contactor.no`,
                        },
                    })
                }
            },
            update: () => {},
        })
    }
})
