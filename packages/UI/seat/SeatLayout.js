import LocalVideo from './LocalVideo'
import {
  getLocalParticipant as getLocalParticipantFromStore
} from '../../../react/features/base/participants';

let localVideoThumbnail = null;

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

}