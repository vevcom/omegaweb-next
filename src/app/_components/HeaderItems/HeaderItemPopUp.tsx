
import PopUp from '@/components/PopUp/PopUp'
import React from 'react'
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome'
import {
    faArchive, faCog, faCreditCard, faEye, faPen, faPlus, faQrcode, faQuestionCircle, faTag, faTrash, faUpload, faUsers
} from '@fortawesome/free-solid-svg-icons'
import type { PropTypes as PopUpProps } from '@/components/PopUp/PopUp'

type PropTypes = Omit<PopUpProps, 'showButtonContent'> & { scale?: number, label?: React.ReactNode }

function createHeaderItemPopUp(icon: FontAwesomeIconProps['icon'], scale = 40, defaultLabel?: string) {
    return function HeadItemPopUp({ showButtonClass, children, scale: overrideScale, label = defaultLabel, ...props }:
                                  PropTypes) {
        const buttonScale = overrideScale ?? scale
        const iconScale = Math.round(buttonScale * (label ? 0.4 : 0.55))
        const iconStyle = { width: `${iconScale}px`, height: `${iconScale}px` }

        return <PopUp
            {...props}
            showButtonContent = {
                label ? (
                    <>
                        <span className="text-m font-medium whitespace-nowrap">{label}</span>
                        <FontAwesomeIcon style={iconStyle} icon={icon} />
                    </>
                ) : (
                    <FontAwesomeIcon style={iconStyle} icon={icon} />
                )
            }
            showButtonStyle={{
                height: `${buttonScale}px`,
                ...(label ? {} : { width: `${buttonScale}px` }),
            }}
            showButtonClass={`
                border-none rounded-inner bg-surface-hover cursor-pointer transition-[background-color,color,box-shadow]
                duration-300
                hover:bg-surface-subtle hover:text-ink-strong
                ${label
        ? 'flex flex-row items-center gap-3 pr-3.5 pl-5 text-ink-strong [&_svg]:text-text '
                        + '[&_svg]:transition-colors [&_svg]:duration-300 hover:[&_svg]:text-accent-blue'
        : 'grid place-items-center text-text'}
                ${showButtonClass ?? ''}
            `}
        >
            { children }
        </PopUp>
    }
}

/**
 * Component that is a popup using the + icon mostly used as header items to
 * f.ex add users or create new ombul, image, ...
 * Often a Form will be rendered as children
 */
export const AddHeaderItemPopUp = createHeaderItemPopUp(faPlus, 40, 'Ny')

/**
 * Component that can be used to show a help pop up for a page
 */
export const HelpHeaderItemPopUp = createHeaderItemPopUp(faQuestionCircle, 18)

/**
 * Component that can be used to show a settings pop up for a page
 */
export const SettingsHeaderItemPopUp = createHeaderItemPopUp(faCog, 18)

export const UsersHeaderItemPopUp = createHeaderItemPopUp(faUsers, 18)

/**
 * Component that can be used to show an upload pop up for a page
 */
export const UploadHeaderItemPopUp = createHeaderItemPopUp(faUpload)

/**
 * Component that can be used to show a visibility pop up for a page
 */
export const VisibilityHeaderItemPopUp = createHeaderItemPopUp(faEye)

/**
 * Component that can be used to show a tag pop up for a page
 */
export const TagHeasderItemPopUp = createHeaderItemPopUp(faTag)

/**
 * Component that can be used to show a archive pop up for a page
 */
export const ArchiveHeaderItemPopUp = createHeaderItemPopUp(faArchive, 40, 'Arkiv')

/**
 * Component that can be used to open a QR code scanner in a pop up
 */
export const ScanHeaderItemPopUp = createHeaderItemPopUp(faQrcode, 40, 'Skann')

/**
 * Component that can be used to show the form that edits a page's subject in a pop up
 */
export const EditHeaderItemPopUp = createHeaderItemPopUp(faPen, 18)

/**
 * Component that can be used to show payment settings, such as the account paid into, in a pop up
 */
export const PaymentHeaderItemPopUp = createHeaderItemPopUp(faCreditCard, 18)

/**
 * Component that can be used to show a delete confirmation in a pop up
 */
export const DeleteHeaderItemPopUp = createHeaderItemPopUp(faTrash, 18)
