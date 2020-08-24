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

const SeatLayout = {
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

        const remoteVideo = new RemoteVideo(jitsiParticipant, SeatLayout);
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

    onRemoteStreamAdded(stream) {
        const id = stream.getParticipantId();
        const remoteVideo = remoteVideos[id];
        logger.debug(`Received a new ${stream.getType()} stream for ${id}`);
        if (!remoteVideo) {
            logger.debug('No remote video element to add stream');

            return;
        }
        remoteVideo.addRemoteStreamElement(stream);
    },


    onRemoteStreamRemoved(stream) {
        const id = stream.getParticipantId();
        const remoteVideo = remoteVideos[id];

        // Remote stream may be removed after participant left the conference.

        if (remoteVideo) {
            remoteVideo.removeRemoteStreamElement(stream);
        }

    },


    // FIXME: what does this do???
    remoteVideoActive(videoElement, resourceJid) {
        logger.info(`${resourceJid} video is now active`, videoElement);
        if (videoElement) {
            $(videoElement).show();
        }
    },

}

export default SeatLayout