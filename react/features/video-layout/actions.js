// @flow

import type { Dispatch } from 'redux';

import {
    SCREEN_SHARE_PARTICIPANTS_UPDATED,
    SET_TILE_VIEW,
    SET_SEAT_SIZE,
    SET_LAYOUT_SIZE
} from './actionTypes';
import { shouldDisplayTileView, caculateLayoutSize } from './functions';


export function setLayoutSize(clientWidth: number = 0, clientHeight: number = 0){
    let res = {
        type: SET_LAYOUT_SIZE,
        layoutSize: caculateLayoutSize(clientWidth, clientHeight)
    }
    console.log('>>>>>>>>>layoutSize1', res)
    return res
}



/**
 * Creates a (redux) action which signals that the list of known participants
 * with screen shares has changed.
 *
 * @param {string} participantIds - The participants which currently have active
 * screen share streams.
 * @returns {{
 *     type: SCREEN_SHARE_PARTICIPANTS_UPDATED,
 *     participantId: string
 * }}
 */
export function setParticipantsWithScreenShare(participantIds: Array<string>) {
    return {
        type: SCREEN_SHARE_PARTICIPANTS_UPDATED,
        participantIds
    };
}

/**
 * Creates a (redux) action which signals to set the UI layout to be tiled view
 * or not.
 *
 * @param {boolean} enabled - Whether or not tile view should be shown.
 * @returns {{
 *     type: SET_TILE_VIEW,
 *     enabled: ?boolean
 * }}
 */
export function setTileView(enabled: ?boolean) {
    return {
        type: SET_TILE_VIEW,
        enabled
    };
}

/**
 * Creates a (redux) action which signals either to exit tile view if currently
 * enabled or enter tile view if currently disabled.
 *
 * @returns {Function}
 */
export function toggleTileView() {
    return (dispatch: Dispatch<any>, getState: Function) => {
        const tileViewActive = shouldDisplayTileView(getState());

        dispatch(setTileView(!tileViewActive));
    };
}
