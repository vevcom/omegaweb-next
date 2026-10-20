'use client'

import Button from '@/components/UI/Button'
import EventLocationMap from '@/components/Event/EventLocationMap'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import { SelectString } from '@/components/UI/Select'
import { readLocationMap } from '@/lib/maps/locationMap'
import { useState } from 'react'
import type { LocationMap } from '@/lib/maps/locationMap'

type PropTypes = {
    name: string,
    defaultValue?: unknown,
}

export default function EventLocationInput({ name, defaultValue }: PropTypes) {
    const initialLocation = readLocationMap(defaultValue)
    const [preview, setPreview] = useState<LocationMap | null>(initialLocation)
    const [provider, setProvider] = useState(initialLocation?.provider ?? 'NONE')
    const [mazeMapUrl, setMazeMapUrl] = useState(initialLocation?.provider === 'MAZEMAP' ? initialLocation.url : '')
    const [latitude, setLatitude] = useState(
        initialLocation?.provider === 'OPENSTREETMAP' ? String(initialLocation.latitude) : ''
    )
    const [longitude, setLongitude] = useState(
        initialLocation?.provider === 'OPENSTREETMAP' ? String(initialLocation.longitude) : ''
    )
    let locationMap: unknown = null
    if (provider === 'MAZEMAP') locationMap = { provider, url: mazeMapUrl }
    if (provider === 'OPENSTREETMAP') {
        locationMap = {
            provider,
            latitude: latitude.trim() ? Number(latitude) : null,
            longitude: longitude.trim() ? Number(longitude) : null,
        }
    }

    const validLocation = readLocationMap(locationMap)

    return <fieldset
        className="min-w-0 m-0 p-0 border-none flex flex-col gap-4 [&_legend]:mb-2 [&_legend]:font-bold [&>button]:self-start"
    >
        <legend>Kart til arrangementet</legend>
        <SelectString
            name={`${name}Provider`}
            label="Karttype"
            value={provider}
            onChange={value => {
                setProvider(value)
                setPreview(null)
            }}
            options={[
                { value: 'NONE', label: 'Uten kart' },
                { value: 'MAZEMAP', label: 'MazeMap' },
                { value: 'OPENSTREETMAP', label: 'OpenStreetMap' },
            ]}
        />
        {provider === 'MAZEMAP' && <>
            <p>Velg et sted i MazeMap og lim inn den fulle lenken fra delingsmenyen.</p>
            <TextInput
                name={`${name}Url`}
                label="MazeMap-lenke"
                aria-label="MazeMap-lenke"
                required
                value={mazeMapUrl}
                onChange={event => setMazeMapUrl(event.target.value)}
            />
        </>}
        {provider === 'OPENSTREETMAP' && <>
            <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">
                Finn koordinater i Google Maps
            </a>
            <div className="grid grid-cols-2 gap-4 max-mobile:grid-cols-1">
                <NumberInput
                    name={`${name}Latitude`}
                    label="Breddegrad"
                    aria-label="Breddegrad"
                    min={-85}
                    max={85}
                    step="any"
                    required
                    value={latitude}
                    onChange={event => setLatitude(event.target.value)}
                />
                <NumberInput
                    name={`${name}Longitude`}
                    label="Lengdegrad"
                    aria-label="Lengdegrad"
                    min={-180}
                    max={180}
                    step="any"
                    required
                    value={longitude}
                    onChange={event => setLongitude(event.target.value)}
                />
            </div>
        </>}
        <input type="hidden" name={name} value={JSON.stringify(locationMap)} />
        {provider !== 'NONE' && <Button
            type="button"
            color="secondary"
            disabled={!validLocation}
            onClick={() => setPreview(validLocation)}
        >
            Forhåndsvis kart
        </Button>}
        <EventLocationMap locationMap={preview} height="250px" />
    </fieldset>
}
