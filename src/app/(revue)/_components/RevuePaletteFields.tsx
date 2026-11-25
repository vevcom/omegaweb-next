'use client'
import { revueThemeOf } from '@/app/(revue)/_lib/revueTheme'
import FormSection from '@/components/Form/FormSection'
import ColorInput from '@/components/UI/ColorInput'
import { contrastRatio, readableContrast } from '@/lib/colors'
import { scopedThemeProps } from '@/lib/theme'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'

type PropTypes = {
    defaultPalette: RevuePalette,
}

const paletteFields: { name: keyof RevuePalette, label: string }[] = [
    { name: 'themeBackground', label: 'Bakgrunn' },
    { name: 'themePrimary', label: 'Primærfarge' },
    { name: 'themeSecondary', label: 'Sekundærfarge' },
    { name: 'themeAccent', label: 'Aksentfarge' },
]

const ratioFormat = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** The four colours of a revue in a form, with a preview of the theme they give as they are picked. */
export default function RevuePaletteFields({ defaultPalette }: PropTypes) {
    const [palette, setPalette] = useState(defaultPalette)

    return <>
        <FormSection legend="Farger" columns={2}>
            {paletteFields.map(({ name, label }) => <ColorInput
                key={name}
                name={name}
                label={label}
                defaultValue={defaultPalette[name]}
                onChange={event => setPalette(previous => ({ ...previous, [name]: event.target.value }))}
            />)}
        </FormSection>
        <RevueThemePreview palette={palette} />
    </>
}

/**
 * A small page painted with the theme of the palette, and how well the text, the primary and the accent
 * of that theme read on its background, which whoever picks it is warned of and not stopped by.
 */
function RevueThemePreview({ palette }: { palette: RevuePalette }) {
    const theme = revueThemeOf(palette)
    const background = theme['--color-base-100']

    return (
        <div className="flex flex-col gap-2 mb-4">
            <p className="m-0 text-s text-base-content/80">Forhåndsvisning</p>
            <div
                {...scopedThemeProps(theme)}
                className="flex flex-col gap-3 p-4 rounded-round border border-base-300 bg-base-100 text-base-content"
            >
                <p className="m-0 font-secondary text-xl font-bold">Revyens overskrift</p>
                <p className="m-0">
                    Slik ser teksten ut på revyens sider, med <span className="text-primary">en lenke</span> i den.
                </p>
                <div className="flex flex-col gap-1 p-3 rounded-inner bg-base-200">
                    <span className="font-semibold">Et kort</span>
                    <span className="text-accent">Med aksentfargen</span>
                </div>
                <span className="btn-primary m-0 self-start">Knapp</span>
            </div>
            <div aria-live="polite" className="flex flex-col gap-2">
                <ContrastOnBackground label="Teksten" color={theme['--color-base-content']} background={background} />
                <ContrastOnBackground label="Primærfargen" color={theme['--color-primary']} background={background} />
                <ContrastOnBackground label="Aksentfargen" color={theme['--color-accent']} background={background} />
            </div>
        </div>
    )
}

function ContrastOnBackground({ label, color, background }: { label: string, color: string, background: string }) {
    const ratio = contrastRatio(color, background)
    const readable = ratio >= readableContrast

    return (
        <p className="m-0 text-s">
            {label} mot bakgrunnen: <span className="font-semibold tabular-nums">{ratioFormat.format(ratio)}:1</span>
            {!readable && <span className="block mt-1">
                <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 text-warning" />
                Under {ratioFormat.format(readableContrast)}:1, så tekst i denne fargen på bakgrunnen er vanskelig å lese.
            </span>}
        </p>
    )
}
