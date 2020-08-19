import {
    init
} from "amplitude-js";

import {
    createLocalTracksF,
    isUserInteractionRequiredForUnmute,
} from './react/features/base/tracks';

import {
    JitsiMediaDevicesEvents,
} from './react/features/base/lib-jitsi-meet';

import {
    mediaPermissionPromptVisibilityChanged
} from './react/features/overlay';

import {
    openConnection
} from './connection';

let room;

/**
 * Open Connection
 * @param roomName the room name to use
 * @returns Promise<JitsiConnection>
 */
function connect(roomName) {
    return openConnection({
            retry: true,
            roomName
        })
        .catch(err => {
            APP.UI.notifyConnectionFailed(err);
            throw err;
        });
}

/**
 * Mute or unmute local audio stream if it exists.
 * @param {boolean} muted - if audio stream should be muted or unmuted.
 */
function muteLocalAudio(muted) {
    APP.store.dispatch(setAudioMuted(muted));
}

export default {
    isJoined() {
        return room && room.isJoined();
    },

    async init({
        roomName
    }) {
        const initialOptions = {
            startAudioOnly: config.startAudioOnly,
            startWithAudioMuted: config.startWithAudioMuted ||
                config.startSilent ||
                isUserInteractionRequiredForUnmute(APP.store
                    .getState()),
            startWithVideoMuted: config.startWithVideoMuted ||
                isUserInteractionRequiredForUnmute(APP.store.getState())
        };

        this.roomName = roomName;

        const [tracks, con] = await this.createInitialLocalTracksAndConnect(
            roomName, initialOptions);

        return this.startConference()
    },

    startConference(con, tracks) {
        return new Promise((resolve, reject) => {

        })
    },

    /**
     * Creates local media tracks and connects to a room. Will show error
     * dialogs in case accessing the local microphone and/or camera failed. Will
     * show guidance overlay for users on how to give access to camera and/or
     * microphone.
     * @param {string} roomName
     * @param {object} options
     * @param {boolean} options.startAudioOnly=false - if <tt>true</tt> then
     * only audio track will be created and the audio only mode will be turned
     * on.
     * @param {boolean} options.startWithAudioMuted - will start the conference
     * without any audio tracks.
     * @param {boolean} options.startWithVideoMuted - will start the conference
     * without any video tracks.
     * @returns {Promise.<JitsiLocalTrack[], JitsiConnection>}
     */
    createInitialLocalTracksAndConnect(roomName, options = {}) {
        const {
            tryCreateLocalTracks,
            errors
        } = this.createInitialLocalTracks(options);
        const {
            audioAndVideoError,
            audioOnlyError,
            screenSharingError,
            videoOnlyError
        } = errors;

        return Promise.all([tryCreateLocalTracks, connect(roomName)])
            .then(([tracks, con]) => {
                if (audioAndVideoError || audioOnlyError) {
                    if (audioOnlyError || videoOnlyError) {
                        // If both requests for 'audio' + 'video' and 'audio'
                        // only failed, we assume that there are some problems
                        // with user's microphone and show corresponding dialog.
                        APP.store.dispatch(notifyMicError(audioOnlyError));
                        APP.store.dispatch(notifyCameraError(
                            videoOnlyError));
                    } else {
                        // If request for 'audio' + 'video' failed, but request
                        // for 'audio' only was OK, we assume that we had
                        // problems with camera and show corresponding dialog.
                        APP.store.dispatch(
                            notifyCameraError(audioAndVideoError));
                    }
                }

                return [tracks, con];
            })
    },

    /**
     * Returns an object containing a promise which resolves with the created tracks &
     * the errors resulting from that process.
     *
     * @returns {Promise<JitsiLocalTrack[]>, Object}
     */
    createInitialLocalTracks(options = {}) {
        const errors = {};
        const initialDevices = ['audio'];
        const requestedAudio = true;
        let requestedVideo = false;

        if (options.startWithAudioMuted) {
            this.muteAudio(true, true);
        }

        if (!options.startWithVideoMuted &&
            !options.startAudioOnly) {
            initialDevices.push('video');
            requestedVideo = true;
        }

        JitsiMeetJS.mediaDevices.addEventListener(
            JitsiMediaDevicesEvents.PERMISSION_PROMPT_IS_SHOWN,
            browser =>
            APP.store.dispatch(
                mediaPermissionPromptVisibilityChanged(true, browser))
        );

        let tryCreateLocalTracks;

        if (!requestedAudio && !requestedVideo) {
            // Resolve with no tracks
            tryCreateLocalTracks = Promise.resolve([]);
        } else {
            tryCreateLocalTracks = createLocalTracksF({
                    devices: initialDevices
                }, true)
                .catch(err => {
                    if (requestedAudio && requestedVideo) {

                        // Try audio only...
                        errors.audioAndVideoError = err;

                        return (
                            createLocalTracksF({
                                devices: ['audio']
                            }, true));
                    } else if (requestedAudio && !requestedVideo) {
                        errors.audioOnlyError = err;

                        return [];
                    } else if (requestedVideo && !requestedAudio) {
                        errors.videoOnlyError = err;

                        return [];
                    }
                    logger.error('Should never happen');
                })
                .catch(err => {
                    // Log this just in case...
                    if (!requestedAudio) {
                        logger.error('The impossible just happened', err);
                    }
                    errors.audioOnlyError = err;

                    // Try video only...
                    return requestedVideo ?
                        createLocalTracksF({
                            devices: ['video']
                        }, true) : [];
                })
                .catch(err => {
                    // Log this just in case...
                    if (!requestedVideo) {
                        logger.error('The impossible just happened', err);
                    }
                    errors.videoOnlyError = err;

                    return [];
                });
        }
        // Hide the permissions prompt/overlay as soon as the tracks are
        // created. Don't wait for the connection to be made, since in some
        // cases, when auth is rquired, for instance, that won't happen until
        // the user inputs their credentials, but the dialog would be
        // overshadowed by the overlay.
        tryCreateLocalTracks.then(tracks => {
            APP.store.dispatch(mediaPermissionPromptVisibilityChanged(
                false));

            return tracks;
        });

        return {
            tryCreateLocalTracks,
            errors
        };
    },

    /**
     * Simulates toolbar button click for audio mute. Used by shortcuts and API.
     * @param {boolean} mute true for mute and false for unmute.
     * @param {boolean} [showUI] when set to false will not display any error
     * dialogs in case of media permissions error.
     */
    muteAudio(mute, showUI = true) {
        if (!mute &&
            isUserInteractionRequiredForUnmute(APP.store.getState())) {
            logger.error('Unmuting audio requires user interaction');

            return;
        }

        // Not ready to modify track's state yet
        if (!this._localTracksInitialized) {
            // This will only modify base/media.audio.muted which is then synced
            // up with the track at the end of local tracks initialization.
            muteLocalAudio(mute);
            this.setAudioMuteStatus(mute);

            return;
        } else if (this.isLocalAudioMuted() === mute) {
            // NO-OP
            return;
        }
    },

    /**
     * Sets the audio muted status.
     *
     * @param {boolean} muted - New muted status.
     */
    setAudioMuteStatus(muted) {
        APP.UI.setAudioMuted(this.getMyUserId(), muted);
        APP.API.notifyAudioMutedStatusChanged(muted);
    },

}