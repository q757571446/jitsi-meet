import LocalVideo from './LocalVideo'
import RemoteVideo from './RemoteVideo'
import Logger from 'jitsi-meet-logger';

import {
    getLocalParticipant as getLocalParticipantFromStore
} from '../../../react/features/base/participants';
const logger = Logger.getLogger(__filename);
let localVideoThumbnail = null;
const remoteVideos = {};
/**
 * Private helper to get the redux representation of the local participant.
 *
 * @private
 * @returns {Object}
 */
function getLocalParticipant() {
    return getLocalParticipantFromStore(APP.store.getState());
}

export default {
    init() {
        localVideoThumbnail = new LocalVideo()
    },
    changeLocalVideo(stream) {
        const localId = getLocalParticipant().id;

        localVideoThumbnail.changeVideo(stream);
    },
    /**
     * Creates a participant container for the given id.
     *
     * @param {Object} participant - The redux representation of a remote
     * participant.
     * @returns {void}
     */
    addRemoteParticipantContainer(participant) {
        if (!participant || participant.local) {
            return;
        }

        const id = participant.id;
        const jitsiParticipant = APP.classroom.getParticipantById(id);

        const remoteVideo = new RemoteVideo(jitsiParticipant);
        this.addRemoteVideoContainer(id, remoteVideo);
    },
    
    removeParticipantContainer(id) {
        const remoteVideo = remoteVideos[id];

        if (remoteVideo) {
            // Remove remote video
            logger.info(`Removing remote video: ${id}`);
            delete remoteVideos[id];
            remoteVideo.remove();
        } else {
            logger.warn(`No remote video for ${id}`);
        }
    },

    /**
     * Adds remote video container for the given id and <tt>SmallVideo</tt>.
     *
     * @param {string} the id of the video to add
     * @param {SmallVideo} smallVideo the small video instance to add as a
     * remote video
     */
    addRemoteVideoContainer(id, remoteVideo) {
        remoteVideos[id] = remoteVideo;

        // Initialize the view
        remoteVideo.updateView();
    },
}