'use client'

import styles from './Dropzone.module.scss'
import React, {
    useCallback,
    useRef,
    useEffect,
} from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faTrash, faCheck, faSpinner, faExclamation } from '@fortawesome/free-solid-svg-icons'
import type {
    InputHTMLAttributes,
    ChangeEvent,
    DragEvent
} from 'react'

export type FileWithStatus = {
    file: File
    uploadStatus: 'pending' | 'uploading' | 'done' | 'error'
}

type PropTypes = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'multiple'> & {
    label: string,
    name: string,
    files: FileWithStatus[]
    setFiles: React.Dispatch<React.SetStateAction<FileWithStatus[]>>
}

const trashClassName = `
    bg-transparent border-none
    hover:cursor-pointer
    [&>svg]:size-[20px] [&>svg]:text-accent-red
`

const byteToUnderstandable = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} bytes`
    }
    if (bytes < 1024 ** 2) {
        return `${(bytes / 1024).toFixed(2)} KB`
    }
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

export default function Dropzone({ label, name, files, setFiles, ...props }: PropTypes) {
    const input = useRef<HTMLInputElement>(null)
    const infoContainerRef = useRef<HTMLUListElement>(null)

    //Databindes the file state to the input value
    useEffect(() => {
        if (input.current) {
            const dataTransfer = new DataTransfer()
            files.forEach(file => dataTransfer.items.add(file.file))
            input.current.files = dataTransfer.files
        }
    }, [files])

    useEffect(() => {
        if (!infoContainerRef.current) return
        const uploadingIndex = files.findIndex(file => file.uploadStatus === 'uploading')
        infoContainerRef.current.children[uploadingIndex]?.scrollIntoView({ behavior: 'smooth' })
    }, [files])

    const getFiles = useCallback((files_: FileList | null) => Array.from(files_ ?? []).map(
        file => ({ file, uploadStatus: 'pending' as const })
    ), [])

    const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        const droppedFiles = getFiles(event.dataTransfer.files)
        setFiles(prev => [...prev, ...droppedFiles])

        if (input.current) {
            input.current.blur()
        }
    }, [getFiles, setFiles])
    const filesUpdated = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault()
        const newFiles = getFiles(event.target.files)
        setFiles(prev => [...prev, ...newFiles])
        if (input.current) {
            input.current.blur()
        }
    }, [getFiles, setFiles])

    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        input.current?.focus()
    }

    const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        if (input.current) {
            input.current.blur()
        }
    }

    const handleRemove = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, file: File) => {
        event.preventDefault()
        setFiles(prev => prev.filter(fileItem => fileItem.file !== file))
    }
    const handleRemoveAll = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.preventDefault()
        setFiles([])
    }

    return (
        <div className="h-full w-full flex flex-col">
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`
                    w-full relative border-2 border-dashed border-accent-blue p-6 flex justify-center items-center
                    ${styles.uploader}
                `}
            >
                <input
                    ref={input}
                    name={name}
                    onChange={filesUpdated}
                    type="file"
                    multiple
                    aria-label={label}
                    {...props}
                    className={`
                        peer absolute inset-0 w-full h-full opacity-0
                        hover:cursor-pointer
                        ${props.className ?? ''}
                    `}
                />
                <p className="
                    -z-1 transition-[scale] duration-300
                    peer-hover:scale-105
                ">{label}</p>
                <FontAwesomeIcon
                    icon={faUpload}
                    className="
                        -z-1 transition-[scale] duration-300
                        peer-hover:scale-105
                        w-[30px] h-[30px] m-4
                    "
                />
            </div>
            <span className="mt-4 p-[.5em] bg-[color-mix(in_srgb,var(--accent-blue),white_15%)]">
                <div
                    className="
                        flex justify-between content-center p-[.5em]
                        [&>p]:w-full [&>p]:text-center
                        [&>p:first-child]:text-left
                        [&>p:last-child]:text-right
                    "
                >
                    <p>Til opplasting: {files.length} {files.length === 1 ? 'fil' : 'filer'}</p>
                    <p>Total størrelse: {byteToUnderstandable(files.reduce((acc, file) => acc + file.file.size, 0))}</p>
                    <p>
                        <button className={trashClassName} onClick={handleRemoveAll}>
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </p>
                </div>
                <ul ref={infoContainerRef} className="h-[200px] overflow-y-scroll">
                    {files.map((file, index) => (
                        <li
                            id={`fileInfo${index}`}
                            key={`fileInfo${index}`}
                            className="
                                flex justify-between rounded-round p-[.5em] my-[.3em]
                                bg-[color-mix(in_srgb,var(--accent-blue),white_40%)]
                            "
                        >
                            <img
                                src={URL.createObjectURL(file.file)}
                                alt={file.file.name}
                                className="size-[40px] min-w-[40px] min-h-[40px] object-contain"
                            />
                            <p className="w-full mx-2">{file.file.name}</p>
                            <p className="w-full mx-2">{byteToUnderstandable(file.file.size)}</p>
                            <UploadStatusIcon status={file.uploadStatus} />
                            <button className={trashClassName} onClick={(e) => handleRemove(e, file.file)}>
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </li>
                    ))}
                </ul>
            </span>
        </div>
    )
}

function UploadStatusIcon({ status }: { status: FileWithStatus['uploadStatus'] }) {
    switch (status) {
        case 'done':
            return <FontAwesomeIcon icon={faCheck} />
        case 'uploading':
            return <FontAwesomeIcon icon={faSpinner} spin />
        case 'error':
            return <FontAwesomeIcon icon={faExclamation} />
        default:
            return <></>
    }
}
