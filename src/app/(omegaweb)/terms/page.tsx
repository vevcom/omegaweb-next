import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

const LAST_UPDATED = '21. oktober 2026'

const boxClassName = `
    bg-surface-raised rounded-round py-4 px-6 mb-8
    [&>h2]:mt-0 [&>h2]:mb-4 [&>h2]:font-secondary [&>h2]:text-l
`

/**
 * Lovdata publishes personvernforordningen (GDPR) as part of personopplysningsloven with one page
 * per article, so every article reference below can point straight at the article's own text.
 */
const gdprArticle = (article: number) => `https://lovdata.no/lov/2018-06-15-38/gdpr/a${article}`

const PERSONOPPLYSNINGSLOVEN = 'https://lovdata.no/lov/2018-06-15-38'
const BOKFORINGSLOVEN_OPPBEVARING = 'https://lovdata.no/lov/2004-11-19-73/§13'
const DATATILSYNET_KLAGE = 'https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/klage-til-datatilsynet/'

/** A reference to a law: opens in a new tab so a reader checking a paragraph keeps this page. */
function LawLink({ href, children }: { href: string, children: ReactNode }) {
    return <a href={href} target="_blank" rel="noreferrer">{children}</a>
}

export const metadata: Metadata = {
    title: 'Vilkår og personvern',
    description: 'Vilkår for bruk av Veven og personvernerklæring for Sanctus Omega Broderskab.',
}

export default function Terms() {
    const emailDomain = process.env.EMAIL_DOMAIN

    return (
        <PageWrapper>
            <PageTitleSetter title="Vilkår og personvern" />

            <article className="
                mx-auto max-w-[80ch] pb-16 text-m leading-[1.7em]
                [&>h2]:mt-16 [&>h2]:mb-4 [&>h2]:font-secondary [&>h2]:text-xl [&>h2]:scroll-mt-[64px]
                [&_h3]:mt-10 [&_h3]:mb-2 [&_h3]:text-l [&_h3]:font-medium
                [&_p]:mb-4
                [&_:is(ul,ol)]:pl-8 [&_:is(ul,ol)]:mb-4
                [&_li]:mb-2
                [&_a]:text-accent-blue [&_a]:no-underline
                [&_a:hover]:underline
            ">
                <header>
                    <h1 className="mb-2 normal-case!">Vilkår og personvern</h1>
                    <p className="text-text-muted">Sist oppdatert {LAST_UPDATED}</p>
                </header>

                <section className={boxClassName}>
                    <h2>Kort oppsummert</h2>
                    <ul>
                        <li>
                            Veven drives av linjeforeningen Sanctus Omega Broderskab (Omega) ved NTNU.
                            VevCom har det tekniske ansvaret.
                        </li>
                        <li>
                            Vi lagrer de opplysningene som trengs for å drive et medlemsregister: kontakt&shy;informasjon,
                            medlemskap og verv, påmeldinger, kjøp og det du selv legger ut.
                        </li>
                        <li>
                            Profilen din er bare synlig for innloggede medlemmer - ikke for internett eller søkemotorer.
                        </li>
                        <li>
                            Vi har ingen analyseverktøy, reklame eller sporing, og vi selger ikke opplysninger videre.
                            Derfor har vi heller ingen cookie-banner.
                        </li>
                        <li>
                            Spørsmål, innsyn eller sletting: <a href={`mailto:hs@${emailDomain}`}>hs@{emailDomain}</a>{' '}
                            (personvern) eller <a href={`mailto:vevcom@${emailDomain}`}>vevcom@{emailDomain}</a> (teknisk).
                        </li>
                    </ul>
                </section>

                <nav className={boxClassName} aria-label="Innhold">
                    <h2>Innhold</h2>
                    <ol className="mb-0!">
                        <li><a href="#vilkar">Del 1 - Vilkår for bruk</a></li>
                        <li><a href="#personvern">Del 2 - Personvernerklæring</a></li>
                    </ol>
                </nav>

                <h2 id="vilkar">Del 1 - Vilkår for bruk</h2>

                <h3>1. Hva dette er</h3>
                <p>
                    Veven er nettsiden og medlemssystemet til Sanctus Omega Broderskab, org.nr. 890 384 692,
                    Elektro-bygget, NTNU Gløshaugen, 7491 Trondheim. Ved å opprette en bruker eller bruke de
                    innloggede delene av Veven godtar du disse vilkårene. Avkrysningen
                    «Jeg godtar vilkårene» ved registrering viser til denne siden, og tidspunktet du godtok
                    dem lagres på brukeren din.
                </p>
                <p>
                    Vilkårene gjelder i tillegg til Omegas statutter og det regelverket som gjelder for de
                    enkelte tjenestene, som prikkreglementet og hytteregelverket.
                </p>

                <h3>2. Brukerkonto</h3>
                <ul>
                    <li>
                        Du logger inn med Feide eller med brukernavn og passord. Du er selv ansvarlig for å holde
                        passordet ditt for deg selv, og du skal ikke dele kontoen din med andre.
                    </li>
                    <li>
                        Bytter du passord, avsluttes alle aktive innlogginger på kontoen - også på andre enheter.
                    </li>
                    <li>
                        Du må ha godtatt vilkårene for å bruke de innloggede delene av Veven.
                    </li>
                    <li>
                        Opplysningene om deg skal være riktige. Det du kan rette selv, retter du på profilen din;
                        resten retter en brukeradministrator for deg.
                    </li>
                </ul>

                <h3>3. Innhold du legger ut</h3>
                <p>
                    Du står selv ansvarlig for det du publiserer på Veven - profiltekst, omegasitater, bullshit,
                    artikler, nyheter, bilder, søknadstekster og annet. Du beholder rettighetene til ditt eget
                    innhold, men gir Omega rett til å lagre og vise det på Veven så lenge det ligger der.
                </p>
                <ul>
                    <li>
                        Ikke legg ut noe ulovlig, trakasserende eller diskriminerende, og ikke publiser andres
                        personopplysninger eller bilder av andre uten at de har sagt ja.
                    </li>
                    <li>
                        Laster du opp bilder, skal du ha rett til å bruke dem, og du skal oppgi fotograf og lisens
                        der det finnes felt for det.
                    </li>
                    <li>
                        Administratorer - VevCom, hovedstyret og de komitéene det gjelder - kan redigere eller fjerne
                        innhold på Veven uten å varsle først, se punkt 8.
                    </li>
                </ul>

                <h3>4. Bilder av deg</h3>
                <p>
                    Ved registrering kan du samtykke til å bli tatt bilde av. Samtykket er frivillig, og du kan
                    trekke det tilbake når som helst ved å endre det på profilen din eller ved å kontakte oss.
                    Trekker du det tilbake, gjelder det framover i tid - si fra om det ligger bilder av deg på
                    Veven du vil ha fjernet, så fjerner vi dem.
                </p>

                <h3>5. Kjøp, betaling og bookinger</h3>
                <ul>
                    <li>
                        Kjøp og innbetalinger går gjennom betalingsleverandøren Stripe. Kortopplysningene dine
                        sendes direkte til Stripe - Omega lagrer aldri kortnummeret ditt.
                    </li>
                    <li>
                        Hver bruker har en intern konto med saldo og transaksjonshistorikk. Kjøp og betalinger er
                        bokføringspliktige, og slettes derfor ikke sammen med annet innhold.
                    </li>
                    <li>
                        Ved hyttebooking gjelder hyttekontrakten som vises og godtas i bookingen. Oppgir du navn,
                        e-post og telefonnummer til gjester, må du ha deres samtykke til det.
                    </li>
                    <li>
                        Avbestilling og refusjon avtales med den komitéen som er ansvarlig for kjøpet eller bookingen.
                    </li>
                </ul>

                <h3>6. Prikker og reaksjoner</h3>
                <p>
                    Prikker registreres med begrunnelse, verdi og hvem som ga dem, etter prikkreglementet. Du kan
                    se dine egne prikker når du er innlogget.
                </p>

                <h3>7. Innhenting og bruk av opplysninger fra Veven</h3>
                <p>
                    Opplysningene på Veven er gjort tilgjengelige for at du skal kunne bruke Veven og utføre vervene
                    dine i Omega - ikke for å samles inn, kopieres eller gjenbrukes andre steder. Det er strengt
                    forbudt å
                </p>
                <ul>
                    <li>
                        hente ut opplysninger om brukere i større omfang enn du trenger der og da, uansett metode -
                        skraping, automatiserte oppslag, nedlasting, skjermbilder, kopiering av medlemslister eller
                        eksport gjennom API-et,
                    </li>
                    <li>
                        lagre opplysninger fra Veven i et eget register, en egen database eller et regneark, og
                    </li>
                    <li>
                        overføre, publisere eller ta i bruk opplysninger fra Veven i nettsider, systemer eller
                        tjenester Omega ikke drifter, eller gi dem videre til noen utenfor Omega.
                    </li>
                </ul>
                <p>
                    Forbudet gjelder alle, også komitéer, interessegrupper og brukere som har fått utvidede
                    tillatelser eller en API-nøkkel. At du har tilgang til opplysninger, gir deg ikke rett til å
                    kopiere dem ut eller bruke dem til noe annet enn det tilgangen ble gitt for, jf.{' '}
                    <LawLink href={gdprArticle(5)}>artikkel 5 (1) b om formålsbegrensning</LawLink>. Trenger komitéen
                    din opplysninger fra Veven til noe nytt, spør VevCom og hovedstyret før du henter dem ut.
                </p>
                <p>
                    Kopierer du personopplysninger ut av Veven og inn i et system VevCom ikke drifter, blir du eller
                    komitéen din selv behandlingsansvarlig for dem og trenger et eget rettslig grunnlag etter{' '}
                    <LawLink href={gdprArticle(6)}>artikkel 6</LawLink>. Et slikt uttrekk uten avtale er et brudd på
                    personopplysningssikkerheten: det følges opp etter punkt 8, kan måtte meldes til Datatilsynet, og
                    VevCom kan kreve at opplysningene slettes og at slettingen dokumenteres.
                </p>

                <h3>8. Brudd på vilkårene</h3>
                <p>
                    VevCom forvalter Veven og kan sette i verk tiltak etter disse vilkårene på egen hånd, uten å
                    legge saken fram for hovedstyret først. Tiltakene er å
                </p>
                <ul>
                    <li>fjerne, skjule eller redigere innhold som bryter vilkårene,</li>
                    <li>trekke tilbake tilganger og rettigheter i systemet, og</li>
                    <li>stenge en brukerkonto midlertidig</li>
                </ul>
                <p>
                    Tiltak kan settes i verk uten varsel når det er nødvendig for å stanse et pågående brudd eller
                    for å sikre driften av Veven. Den det gjelder får beskjed om tiltaket og begrunnelsen for det så
                    snart det er praktisk mulig, og kan be om at saken vurderes på nytt - først av VevCom, deretter
                    av hovedstyret, som kan omgjøre tiltaket.
                </p>
                <p>
                    Disse vilkårene gjelder bare tilgangen til Veven. Reaksjoner mot selve medlemskapet i Omega,
                    som eksklusjon, følger Omegas statutter og avgjøres av organene statuttene peker på.
                </p>

                <h3>9. Drift og ansvar</h3>
                <p>
                    Veven driftes på frivillig basis av VevCom. Vi gjør vårt beste for å holde den oppe og
                    opplysningene riktige, men kan ikke garantere feilfri drift. Omega er ikke ansvarlig for tap
                    som følge av nedetid, feil eller tap av data.
                </p>

                <h3>10. Endringer i vilkårene</h3>
                <p>
                    Vi kan endre vilkårene. Vesentlige endringer varsles på Veven eller per e-post, og den
                    gjeldende versjonen ligger alltid på denne siden med dato.
                </p>

                <h2 id="personvern">Del 2 - Personvernerklæring</h2>

                <h3>Behandlingsansvarlig</h3>
                <p>
                    Sanctus Omega Broderskab, org.nr. 890 384 692, er behandlingsansvarlig for
                    personopplysningene som behandles på Veven. Henvendelser om personvern går til hovedstyret
                    på <a href={`mailto:hs@${emailDomain}`}>hs@{emailDomain}</a>, tekniske spørsmål til VevCom
                    på <a href={`mailto:vevcom@${emailDomain}`}>vevcom@{emailDomain}</a>.
                </p>

                <h3>Hvilke opplysninger vi behandler</h3>
                <dl className="
                    mb-4
                    [&>dt]:mt-4 [&>dt]:font-medium [&>dt]:text-ink-strong
                    [&>dd]:mb-2 [&>dd]:border-l [&>dd]:border-surface-subtle [&>dd]:pl-4
                ">
                    <dt>Konto og profil</dt>
                    <dd>
                        Brukernavn, e-postadresse, fornavn og etternavn, telefonnummer, profilbilde, profiltekst,
                        kjønn, allergier og diett, sivilstatus med fritekst, merker (flairs), fargetemaet du har
                        valgt på Veven, når kontoen ble opprettet og sist endret, når du godtok vilkårene og om du
                        har samtykket til å bli tatt bilde av. Kjønn, allergier, sivilstatus, telefonnummer og
                        profilbilde er frivillige.
                    </dd>

                    <dt>Innlogging</dt>
                    <dd>
                        Passordet ditt lagres bare som en kryptografisk hash, i en egen tabell skilt fra resten av
                        brukeropplysningene. Logger du inn med Feide, lagrer vi Feide-kontoens id og e-postadresse.
                        Registrerer du studentkortet ditt, lagrer vi kortnummeret.
                    </dd>

                    <dt>Medlemskap og verv</dt>
                    <dd>
                        Medlemskap i komitéer, interessegrupper, klasser, kull og medlemsgrupper, med start- og
                        sluttdato, tillatelsene du har i systemet, og studieprogrammene Feide har oppgitt for deg.
                    </dd>

                    <dt>Aktivitet</dt>
                    <dd>
                        Påmeldinger til arrangementer, søknader til komitéer med søknadstekst, gjennomførte opptak
                        (plikttjeneste og prøvelsen), prikker med begrunnelse, skapreservasjoner, hyttebookinger,
                        kjøp og transaksjoner på den interne kontoen din, varslingsabonnement og hvilke e-postlister
                        du står på, og innhold du har lagt ut som omegasitater og bullshit.
                    </dd>

                    <dt>Teknisk</dt>
                    <dd>
                        En informasjonskapsel som holder deg innlogget, og driftslogger på serveren med
                        feilmeldinger og hendelser fra bruken av systemet.
                    </dd>
                </dl>

                <h3>Hvor opplysningene kommer fra</h3>
                <p>
                    Fra deg selv ved registrering og når du redigerer profilen. Fra Feide når du logger inn med
                    Feide - navn, e-postadresse, telefonnummer, brukeridentifikator og hvilke studieprogrammer du
                    tilhører. Fra administratorer som registrerer medlemskap, verv, prikker og kjøp. Og fra
                    kortleseren på Kiogeskabet når du registrerer studentkortet ditt.
                </p>

                <h3>Hvorfor vi behandler dem, og rettslig grunnlag</h3>
                <ul>
                    <li>
                        <strong>For å oppfylle avtalen med deg og drive medlemskapet</strong> - brukerkonto,
                        medlemsregister, påmeldinger, bookinger og kjøp.{' '}
                        <LawLink href={gdprArticle(6)}>Personvernforordningen artikkel 6 (1) b</LawLink>.
                    </li>
                    <li>
                        <strong>Samtykke</strong> - å bli tatt bilde av, allergier og diett, kjønn, sivilstatus og
                        andre frivillige profilopplysninger, og e-postvarsler du selv melder deg på.{' '}
                        <LawLink href={gdprArticle(6)}>Artikkel 6 (1) a</LawLink>. Allergier kan være
                        helseopplysninger, og behandles bare på grunnlag av samtykket ditt og bare for å planlegge mat
                        på arrangementer. <LawLink href={gdprArticle(9)}>Artikkel 9 (2) a</LawLink>.
                    </li>
                    <li>
                        <strong>Berettiget interesse</strong> - drift og sikkerhet, intern historikk om verv og
                        medlemskap, og prikker og reaksjoner etter prikkreglementet.{' '}
                        <LawLink href={gdprArticle(6)}>Artikkel 6 (1) f</LawLink>.
                    </li>
                    <li>
                        <strong>Rettslig forpliktelse</strong> - bokføring av kjøp, betalinger og transaksjoner.{' '}
                        <LawLink href={gdprArticle(6)}>Artikkel 6 (1) c</LawLink>, jf.{' '}
                        <LawLink href={BOKFORINGSLOVEN_OPPBEVARING}>bokføringsloven § 13</LawLink>.
                    </li>
                </ul>

                <h3>Hvem ser hva</h3>
                <ul>
                    <li>
                        Profilen din og medlemslistene er bare tilgjengelige for innloggede brukere som har
                        lesetilgang til brukere. De er ikke åpne for besøkende uten konto eller for søkemotorer.
                    </li>
                    <li>
                        Noe innhold er åpent for alle - nyheter, artikler, arrangementer, karrieresidene og denne
                        siden. Står du oppført som forfatter eller arrangør, er navnet ditt synlig der.
                    </li>
                    <li>
                        Innhold på Veven har et synlighetsnivå. Komitéinternt innhold er bare synlig for de gruppene
                        det gjelder.
                    </li>
                    <li>
                        Administratorer med de relevante tillatelsene - for eksempel brukeradministratorer,
                        hovedstyret og VevCom - ser mer enn vanlige medlemmer, blant annet kontaktopplysninger,
                        prikker og transaksjoner.
                    </li>
                    <li>
                        Å ha tilgang til opplysninger er ikke det samme som å kunne ta dem med seg: ingen kan hente
                        opplysninger ut av Veven for å bruke dem i andre systemer eller på andre nettsider,
                        se punkt 7.
                    </li>
                </ul>

                <h3>Deling med andre</h3>
                <ul>
                    <li><strong>Feide (Sikt)</strong> - innlogging og bekreftelse av studenttilhørighet.</li>
                    <li>
                        <strong>Stripe</strong> - betaling. Stripe mottar det som trengs for å gjennomføre
                        betalingen, og håndterer kortopplysningene dine direkte.
                    </li>
                    <li>
                        <strong>E-post</strong> sendes fra Omegas egen e-postserver. Vi bruker ingen tredjeparts
                        nyhetsbrev&shy;tjeneste.
                    </li>
                </ul>
                <p>
                    Vi har ingen analyseverktøy, reklamenettverk eller sporingspiksler på Veven, og vi selger,
                    låner eller gir ikke bort personopplysninger til andre. Opplysninger utleveres ellers bare
                    når vi er rettslig forpliktet til det.
                </p>

                <h3>Informasjonskapsler</h3>
                <p>
                    Veven bruker informasjonskapsler bare til innlogging. De holder deg innlogget og beskytter selve
                    innloggingen, er nødvendige for at Veven skal virke, og blir ugyldige når du logger ut eller
                    bytter passord. Innstillingene dine, som fargetema, lagres på brukeren din på serveren.
                </p>
                <p>
                    Ellers lagrer Veven to ting i nettleseren din. Under hyttebestilling ligger bestillingen du
                    holder på med (ID, en hemmelig nøkkel, pris og utløpstid) i nettleserens øktlagring, slik at
                    en påbegynt betaling ikke går tapt om du laster siden på nytt. Den forsvinner når du lukker
                    fanen. I tillegg lagrer Veven en kopi av statiske filer som skript, ikoner og stilark, slik at
                    siden laster raskere. Disse er like for alle og inneholder ingenting om deg.
                </p>
                <p>Vi bruker ingen kapsler til analyse eller markedsføring, og derfor heller ingen cookie-banner.</p>

                <h3>Hvor lenge vi lagrer opplysningene</h3>
                <ul>
                    <li>Konto- og profilopplysninger lagres så lenge du har en bruker på Veven.</li>
                    <li>
                        Søknadstekster slettes av komitéen etter at søknadsperioden er over og plassene fordelt.
                        Historikken om hvem som søkte på hva beholdes.
                    </li>
                    <li>
                        Kjøp, betalinger og transaksjoner oppbevares i fem år etter regnskapsårets slutt, slik{' '}
                        <LawLink href={BOKFORINGSLOVEN_OPPBEVARING}>bokføringsloven § 13</LawLink> krever - også om
                        kontoen din slettes.
                    </li>
                    <li>Prikker oppbevares etter prikkreglementet.</li>
                    <li>Driftslogger oppbevares bare så lenge det er nødvendig for feilsøking og sikker drift.</li>
                </ul>

                <h3>Rettighetene dine</h3>
                <ul>
                    <li>
                        <strong>Innsyn</strong> i opplysningene vi har om deg, og i hvordan vi bruker dem.{' '}
                        <LawLink href={gdprArticle(15)}>Artikkel 15</LawLink>.
                    </li>
                    <li>
                        <strong>Retting</strong> av opplysninger som er feil eller ufullstendige.{' '}
                        <LawLink href={gdprArticle(16)}>Artikkel 16</LawLink>.
                    </li>
                    <li>
                        <strong>Sletting</strong> av opplysninger vi ikke lenger har grunnlag for å lagre.{' '}
                        <LawLink href={gdprArticle(17)}>Artikkel 17</LawLink>.
                    </li>
                    <li>
                        <strong>Begrensning</strong> av behandlingen mens en sak om retting eller sletting avklares.{' '}
                        <LawLink href={gdprArticle(18)}>Artikkel 18</LawLink>.
                    </li>
                    <li>
                        <strong>Dataportabilitet</strong> - å få opplysningene dine utlevert i et maskinlesbart
                        format. <LawLink href={gdprArticle(20)}>Artikkel 20</LawLink>.
                    </li>
                    <li>
                        <strong>Å protestere</strong> mot behandling vi gjør på grunnlag av berettiget interesse.{' '}
                        <LawLink href={gdprArticle(21)}>Artikkel 21</LawLink>.
                    </li>
                    <li>
                        <strong>Å trekke tilbake et samtykke</strong> du har gitt, når som helst. Det påvirker ikke
                        behandlingen vi har gjort før du trakk det tilbake.{' '}
                        <LawLink href={gdprArticle(7)}>Artikkel 7 (3)</LawLink>.
                    </li>
                </ul>
                <p>
                    Mye kan du gjøre selv på profilen din. For resten - inkludert sletting av brukeren, som i dag
                    gjøres av en brukeradministrator - tar du kontakt
                    på <a href={`mailto:hs@${emailDomain}`}>hs@{emailDomain}</a>. Vi svarer så raskt vi kan, og
                    senest innen 30 dager. Noen opplysninger kan vi ikke slette, som bokføringspliktige
                    transaksjoner.
                </p>
                <p>
                    Mener du vi behandler opplysningene dine i strid med regelverket, ta kontakt
                    på <a href={`mailto:hs@${emailDomain}`}>hs@{emailDomain}</a> snarest, slik at vi kan få
                    rettet opp i det. Du kan uansett{' '}
                    <LawLink href={DATATILSYNET_KLAGE}>klage til Datatilsynet</LawLink>.{' '}
                    <LawLink href={gdprArticle(77)}>Artikkel 77</LawLink>.
                </p>

                <h3>Sikkerhet</h3>
                <p>
                    Passord lagres som hash i en egen tabell, tilgang til opplysninger styres av et
                    tillatelsessystem der hver tilgang må gis eksplisitt, og trafikken til Veven går over HTTPS.
                    Oppdager vi et brudd på personopplysningssikkerheten, melder vi det til Datatilsynet uten
                    ugrunnet opphold og senest innen 72 timer der{' '}
                    <LawLink href={gdprArticle(33)}>artikkel 33</LawLink> krever det, og varsler de det gjelder.
                </p>

                <h3>Regelverket</h3>
                <ul>
                    <li>
                        <LawLink href={PERSONOPPLYSNINGSLOVEN}>Personopplysningsloven</LawLink> - loven som gjør
                        personvernforordningen (GDPR) til norsk rett. Artiklene det vises til over, står i fulltekst
                        der.
                    </li>
                    <li>
                        <LawLink href={BOKFORINGSLOVEN_OPPBEVARING}>Bokføringsloven § 13</LawLink> - oppbevaringsplikten
                        for kjøp, betalinger og transaksjoner.
                    </li>
                    <li>
                        <LawLink href="https://www.datatilsynet.no">Datatilsynet</LawLink> - tilsynsmyndigheten for
                        personvern i Norge.
                    </li>
                </ul>

                <h3>Varsling</h3>
                <p>
                    Opplever du noe som ikke skal skje i Omega, kan du <Link href="/report">varsle her</Link>.
                </p>
            </article>
        </PageWrapper>
    )
}
