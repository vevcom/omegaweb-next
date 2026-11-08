import { FileInput } from '@ohma/ui'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/**
 * The chosen file name is component state, reachable only through a real
 * selection — so populate the actual <input type="file"> and fire the same
 * change event the browser would, rather than faking the filled markup.
 */
function SelectFilesOnMount({ names, children }: { names: string[], children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        ref.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => {
            const transfer = new DataTransfer()
            for (const name of names) {
                transfer.items.add(new File(['ohma'], name, { type: 'application/octet-stream' }))
            }
            input.files = transfer.files
            input.dispatchEvent(new Event('change', { bubbles: true }))
        })
    }, [])
    return <div ref={ref}>{children}</div>
}

/**
 * Styled like the other form fields: the real input is visually hidden but
 * focusable, and the surface doubles as the label that opens the picker. The
 * chosen file name takes the place of the field value, so the floating label
 * behaves exactly as it does in TextInput.
 */
export const Empty = () => (
    <div style={{ maxWidth: '22rem' }}>
        <FileInput name="avatar" label="Velg profilbilde" accept="image/*" />
    </div>
)

export const WithFile = () => (
    <SelectFilesOnMount names={['immatrikuleringsball.png']}>
        <div style={{ maxWidth: '22rem' }}>
            <FileInput name="avatar" label="Velg profilbilde" accept="image/*" />
        </div>
    </SelectFilesOnMount>
)

/** `color` styles the chosen file name, so each variant needs a selection. */
export const Colors = () => (
    <SelectFilesOnMount names={['ombul-2026-01.pdf']}>
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '22rem' }}>
            <FileInput name="black" label="Black (default)" color="black" />
            <FileInput name="primary" label="Primary" color="primary" />
            <FileInput name="white" label="White" color="white" />
            <FileInput name="red" label="Red" color="red" />
        </div>
    </SelectFilesOnMount>
)

export const MultipleFiles = () => (
    <SelectFilesOnMount names={['bilde-01.png', 'bilde-02.png', 'bilde-03.png']}>
        <div style={{ maxWidth: '22rem' }}>
            <FileInput name="images" label="Bilder" accept="image/*" multiple />
        </div>
    </SelectFilesOnMount>
)

export const OnRaisedSurface = () => (
    <SelectFilesOnMount names={['ombul-2026-01.pdf']}>
        <div style={{
            background: 'var(--color-base-200)',
            padding: '1.5rem',
            borderRadius: 'var(--rounding)',
            maxWidth: '22rem',
        }}>
            <FileInput name="ombulFile" label="Ombul-fil" background="raised" accept="application/pdf" />
        </div>
    </SelectFilesOnMount>
)

export const Disabled = () => (
    <div style={{ maxWidth: '22rem' }}>
        <FileInput name="report" label="Last opp rapport" disabled />
    </div>
)
