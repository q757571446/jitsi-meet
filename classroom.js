import Logger from 'jitsi-meet-logger';

import { showNotification } from './react/features/notifications';
import AuthHandler from './packages/UI/authentication/AuthHandler';
import { createRnnoiseProcessorPromise } from './react/features/rnnoise';
import {
    createTaskQueue
} from './packages/util/helpers';

import {
    createDeviceChangedEvent,
    createStartSilentEvent,
    createScreenSharingEvent,
    createTrackMutedEvent,
    sendAnalytics
} from './react/features/analytics';

import {
    maybeRedirectToWelcomePage,
    redirectToStaticPage,
    reloadWithStoredParams
} from './react/features/app/actions';

import {
    replaceLocalTrack,
    isLocalTrackMuted,
    isLocalVideoTrackMuted,
    createLocalTracksF,
    isUserInteractionRequiredForUnmute,
} from './react/features/base/tracks';

import {
    conferenceFailed,
    conferenceWillJoin,
    conferenceWillLeave,
    sendLocalParticipant
} from './react/features/base/conference';

import {
    isFatalJitsiConnectionError,
    JitsiConferenceErrors,
    JitsiConferenceEvents,
    JitsiConnectionErrors,
    JitsiConnectionEvents,
    JitsiMediaDevicesEvents,
    JitsiParticipantConnectionStatus,
    JitsiTrackErrors,
    JitsiTrackEvents
} from './react/features/base/lib-jitsi-meet';

import {
    MEDIA_TYPE,
    setAudioMuted,
    isVideoMutedByUser,
} from './react/features/base/media';

import {
    mediaPermissionPromptVisibilityChanged
} from './react/features/overlay';

import {
    openConnection
} from './connection';

import {
    getLocalParticipant,
} from './react/features/base/participants';

import {
    getBackendSafePath,
    getJitsiMeetGlobalNS
} from './react/features/base/util';

let room;
let connection;


/**
 *
 */
class ConferenceConnector {
    /**
     *
     */
    constructor(resolve, reject) {
        this._resolve = resolve;
        this._reject = reject;
        this.reconnectTimeout = null;
        room.on(JitsiConferenceEvents.CONFERENCE_JOINED,
            this._handleConferenceJoined.bind(this));
        room.on(JitsiConferenceEvents.CONFERENCE_FAILED,
            this._onConferenceFailed.bind(this));
    }

    /**
     *
     */
    _handleConferenceFailed(err) {
        this._unsubscribe();
        this._reject(err);
    }

    /**
     *
     */
    _onConferenceFailed(err, ...params) {
        APP.store.dispatch(conferenceFailed(room, err, ...params));
        logger.error('CONFERENCE FAILED:', err, ...params);

        switch (err) {

        case JitsiConferenceErrors.NOT_ALLOWED_ERROR: {
            // let's show some auth not allowed page
            APP.store.dispatch(redirectToStaticPage('static/authError.html'));
            break;
        }

        // not enough rights to create conference
        case JitsiConferenceErrors.AUTHENTICATION_REQUIRED: {
            // Schedule reconnect to check if someone else created the room.
            this.reconnectTimeout = setTimeout(() => {
                APP.store.dispatch(conferenceWillJoin(room));
                room.join();
            }, 5000);

            const { password }
                = APP.store.getState()['features/base/conference'];

            AuthHandler.requireAuth(room, password);

            break;
        }

        case JitsiConferenceErrors.RESERVATION_ERROR: {
            const [ code, msg ] = params;

            APP.classroomUI.notifyReservationError(code, msg);
            break;
        }

        case JitsiConferenceErrors.GRACEFUL_SHUTDOWN:
            APP.classroomUI.notifyGracefulShutdown();
            break;

        // FIXME FOCUS_DISCONNECTED is a confusing event name.
        // What really happens there is that the library is not ready yet,
        // because Jicofo is not available, but it is going to give it another
        // try.
        case JitsiConferenceErrors.FOCUS_DISCONNECTED: {
            const [ focus, retrySec ] = params;

            APP.classroomUI.notifyFocusDisconnected(focus, retrySec);
            break;
        }

        case JitsiConferenceErrors.FOCUS_LEFT:
        case JitsiConferenceErrors.ICE_FAILED:
        case JitsiConferenceErrors.VIDEOBRIDGE_NOT_AVAILABLE:
        case JitsiConferenceErrors.OFFER_ANSWER_FAILED:
            APP.store.dispatch(conferenceWillLeave(room));

            // FIXME the conference should be stopped by the library and not by
            // the app. Both the errors above are unrecoverable from the library
            // perspective.
            room.leave().then(() => connection.disconnect());
            break;

        case JitsiConferenceErrors.CONFERENCE_MAX_USERS:
            connection.disconnect();
            APP.classroomUI.notifyMaxUsersLimitReached();
            break;

        case JitsiConferenceErrors.INCOMPATIBLE_SERVER_VERSIONS:
            APP.store.dispatch(reloadWithStoredParams());
            break;

        default:
            this._handleConferenceFailed(err, ...params);
        }
    }

    /**
     *
     */
    _unsubscribe() {
        room.off(
            JitsiConferenceEvents.CONFERENCE_JOINED,
            this._handleConferenceJoined);
        room.off(
            JitsiConferenceEvents.CONFERENCE_FAILED,
            this._onConferenceFailed);
        if (this.reconnectTimeout !== null) {
            clearTimeout(this.reconnectTimeout);
        }
        AuthHandler.closeAuth();
    }

    /**
     *
     */
    _handleConferenceJoined() {
        this._unsubscribe();
        this._resolve();
    }

    /**
     *
     */
    connect() {
        room.join();
    }
}


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
            APP.classroomUI.notifyConnectionFailed(err);
            throw err;
        });
}

/**
 * Handles CONNECTION_FAILED events from lib-jitsi-meet.
 *
 * @param {JitsiConnectionError} error - The reported error.
 * @returns {void}
 * @private
 */
function _connectionFailedHandler(error) {
    if (isFatalJitsiConnectionError(error)) {
        APP.connection.removeEventListener(
            JitsiConnectionEvents.CONNECTION_FAILED,
            _connectionFailedHandler);
        if (room) {
            APP.store.dispatch(conferenceWillLeave(room));
            room.leave();
        }
    }
}

/**
 * Mute or unmute local audio stream if it exists.
 * @param {boolean} muted - if audio stream should be muted or unmuted.
 */
function muteLocalAudio(muted) {
    APP.store.dispatch(setAudioMuted(muted));
}

const logger = Logger.getLogger(__filename);

/**
 * A queue for the async replaceLocalTrack action so that multiple audio
 * replacements cannot happen simultaneously. This solves the issue where
 * replaceLocalTrack is called multiple times with an oldTrack of null, causing
 * multiple local tracks of the same type to be used.
 *
 * @private
 * @type {Object}
 */
const _replaceLocalAudioTrackQueue = createTaskQueue();

/**
 * A task queue for replacement local video tracks. This separate queue exists
 * so video replacement is not blocked by audio replacement tasks in the queue
 * {@link _replaceLocalAudioTrackQueue}.
 *
 * @private
 * @type {Object}
 */
const _replaceLocalVideoTrackQueue = createTaskQueue();

export default {
    /**
     * The local video track (if any).
     * FIXME tracks from redux store should be the single source of truth, but
     * more refactoring is required around screen sharing ('localVideo' usages).
     * @type {JitsiLocalTrack|null}
     */
    localVideo: null,

    /**
     * The local audio track (if any).
     * FIXME tracks from redux store should be the single source of truth
     * @type {JitsiLocalTrack|null}
     */
    localAudio: null,

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

        return this.startConference(con, tracks)
    },

    startConference(con, tracks) {
        // initial mute audio or video
        tracks.forEach(track => {
            if ((track.isAudioTrack() && this.isLocalAudioMuted()) ||
                (track.isVideoTrack() && this.isLocalVideoMuted())) {
                const mediaType = track.getType();

                sendAnalytics(
                    createTrackMutedEvent(mediaType, 'initial mute')
                );
                logger.log(`${mediaType} mute: initially muted.`);
                track.mute();
            }
        });
        logger.log(`Initialized with ${tracks.length} local tracks`);

        this._localTracksInitialized = true;
        con.addEventListener(JitsiConnectionEvents.CONNECTION_FAILED,
            _connectionFailedHandler);
        APP.connection = connection = con;

        this._createRoom(tracks);
        APP.remoteControl.init();

        // if user didn't give access to mic or camera or doesn't have
        // them at all, we mark corresponding toolbar buttons as muted,
        // so that the user can try unmute later on and add audio/video
        // to the conference
        if (!tracks.find(t => t.isAudioTrack())) {
            this.setAudioMuteStatus(true);
        }

        if (!tracks.find(t => t.isVideoTrack())) {
            this.setVideoMuteStatus(true);
        }

        if (config.startSilent) {
            sendAnalytics(createStartSilentEvent());
            APP.store.dispatch(showNotification({
                descriptionKey: 'notify.startSilentDescription',
                titleKey: 'notify.startSilentTitle'
            }));
        }

        // XXX The API will take care of disconnecting from the XMPP
        // server (and, thus, leaving the room) on unload.
        return new Promise((resolve, reject) => {
            (new ConferenceConnector(resolve, reject)).connect();
        });
    },

    _createRoom(localTracks) {
        room
            = connection.initJitsiConference(
                APP.classroom.roomName,
                this._getConferenceOptions());

        APP.store.dispatch(conferenceWillJoin(room));
        this._setLocalAudioVideoStreams(localTracks);
        this._room = room; // FIXME do not use this

        sendLocalParticipant(APP.store, room);

        this._setupListeners();
    },

    /**
     * Setup interaction between conference and UI.
     */
    _setupListeners() {

    },

    /**
     * Sets local video and audio streams.
     * @param {JitsiLocalTrack[]} tracks=[]
     * @returns {Promise[]}
     * @private
     */
    _setLocalAudioVideoStreams(tracks = []) {
        return tracks.map(track => {
            if (track.isAudioTrack()) {
                return this.useAudioStream(track);
            } else if (track.isVideoTrack()) {
                return this.useVideoStream(track);
            }
            logger.error(
                'Ignored not an audio nor a video track: ', track);

            return Promise.resolve();
        });
    },

    /**
     * Start using provided video stream.
     * Stops previous video stream.
     * @param {JitsiLocalTrack} newTrack - new track to use or null
     * @returns {Promise}
     */
    useVideoStream(newTrack) {
        return new Promise((resolve, reject) => {
            _replaceLocalVideoTrackQueue.enqueue(onFinish => {
                const state = APP.store.getState();

                APP.store.dispatch(
                        replaceLocalTrack(this.localVideo,
                            newTrack, room))
                    .then(() => {
                        this.localVideo = newTrack;
                        if (newTrack) {
                            APP.classroomUI.addLocalVideoStream(
                                newTrack);
                        }
                        this.setVideoMuteStatus(this
                            .isLocalVideoMuted());
                    })
                    .then(resolve)
                    .catch(reject)
                    .then(onFinish);
            });
        });
    },

    /**
     * Start using provided audio stream.
     * Stops previous audio stream.
     * @param {JitsiLocalTrack} newTrack - new track to use or null
     * @returns {Promise}
     */
    useAudioStream(newTrack) {
        return new Promise((resolve, reject) => {
            _replaceLocalAudioTrackQueue.enqueue(onFinish => {
                const state = APP.store.getState();

                APP.store.dispatch(
                        replaceLocalTrack(this.localAudio,
                            newTrack, room))
                    .then(() => {
                        this.localAudio = newTrack;
                        this.setAudioMuteStatus(this
                            .isLocalAudioMuted());
                    })
                    .then(resolve)
                    .catch(reject)
                    .then(onFinish);
            });
        });
    },

    _getConferenceOptions() {
        const options = config;
        const {
            email,
            name: nick
        } = getLocalParticipant(APP.store.getState());

        const state = APP.store.getState();
        const {
            locationURL
        } = state['features/base/connection'];
        const {
            tenant
        } = state['features/base/jwt'];

        if (tenant) {
            options.siteID = tenant;
        }

        if (options.enableDisplayNameInStats && nick) {
            options.statisticsDisplayName = nick;
        }

        if (options.enableEmailInStats && email) {
            options.statisticsId = email;
        }

        options.applicationName = interfaceConfig.APP_NAME;
        options.getWiFiStatsMethod = this._getWiFiStatsMethod;
        options.confID =
            `${locationURL.host}${getBackendSafePath(locationURL.pathname)}`;
        options.createVADProcessor = createRnnoiseProcessorPromise;

        // Disable CallStats, if requessted.
        if (options.disableThirdPartyRequests) {
            delete options.callStatsID;
            delete options.callStatsSecret;
            delete options.getWiFiStatsMethod;
        }

        return options;
    },


    /**
     * Returns the result of getWiFiStats from the global NS or does nothing
     * (returns empty result).
     * Fixes a concurrency problem where we need to pass a function when creating
     * JitsiConference, but that method is added to the context later.
     *
     * @returns {Promise}
     * @private
     */
    _getWiFiStatsMethod() {
        const gloabalNS = getJitsiMeetGlobalNS();

        return gloabalNS.getWiFiStats ? gloabalNS.getWiFiStats() : Promise
            .resolve('{}');
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
            });
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
     * Returns whether local audio is muted or not.
     * @returns {boolean}
     */
    isLocalAudioMuted() {
        // If the tracks are not ready, read from base/media state
        return this._localTracksInitialized ?
            isLocalTrackMuted(
                APP.store.getState()['features/base/tracks'],
                MEDIA_TYPE.AUDIO) :
            Boolean(
                APP.store.getState()['features/base/media'].audio.muted);
    },

    /**
     * Tells whether the local video is muted or not.
     * @return {boolean}
     */
    isLocalVideoMuted() {
        // If the tracks are not ready, read from base/media state
        return this._localTracksInitialized ?
            isLocalVideoTrackMuted(
                APP.store.getState()['features/base/tracks']) :
            isVideoMutedByUser(APP.store);
    },

    /**
     * Sets the video muted status.
     *
     * @param {boolean} muted - New muted status.
     */
    setVideoMuteStatus(muted) {
        APP.classroomUI.setVideoMuted(this.getMyUserId(), muted);
        APP.API.notifyVideoMutedStatusChanged(muted);
    },

    /**
     * Sets the audio muted status.
     *
     * @param {boolean} muted - New muted status.
     */
    setAudioMuteStatus(muted) {
        APP.classroomUI.setAudioMuted(this.getMyUserId(), muted);
        APP.API.notifyAudioMutedStatusChanged(muted);
    },

    getMyUserId() {
        return room && room.myUserId();
    },

    /**
     * Disconnect from the conference and optionally request user feedback.
     * @param {boolean} [requestFeedback=false] if user feedback should be
     * requested
     */
    hangup(requestFeedback = false) {

    },
}