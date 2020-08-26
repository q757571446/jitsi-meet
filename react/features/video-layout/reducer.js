// @flow

import { ReducerRegistry } from '../base/redux';

import {
    SCREEN_SHARE_PARTICIPANTS_UPDATED,
    SET_TILE_VIEW,
    SET_LAYOUT_SIZE
} from './actionTypes';

const DEFAULT_STATE = {
    layoutSize: {},
    screenShares: [],
    /**
     * The indicator which determines whether the video layout should display
     * video thumbnails in a tiled layout.
     *
     * Note: undefined means that the user hasn't requested anything in particular yet, so
     * we use our auto switching rules.
     *
     * @public
     * @type {boolean}
     */
    tileViewEnabled: undefined
};

const STORE_NAME = 'features/video-layout';

ReducerRegistry.register(STORE_NAME, (state = DEFAULT_STATE, action) => {
    switch (action.type) {

    case SET_LAYOUT_SIZE:
        return {
            ...state, 
            layoutSize: action.layoutSize
        };
        
    case SCREEN_SHARE_PARTICIPANTS_UPDATED: {
        return {
            ...state,
            screenShares: action.participantIds
        };
    }

    case SET_TILE_VIEW:
        return {
            ...state,
            tileViewEnabled: action.enabled
        };
    }
    

    return state;
});
