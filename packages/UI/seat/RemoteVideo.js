import SeatVideo from "./SeatVideo";
import UIUtils from '../util/UIUtil';
import Logger from 'jitsi-meet-logger';
const logger = Logger.getLogger(__filename);
/**
 *
 * @param {*} spanId
 */
function createContainer(spanId) {
  const container = document.createElement('div');

  container.id = spanId;
  container.className = 'videocontainer';

  container.innerHTML = `
      <div class = 'videocontainer__background'></div>
      <div class = 'videocontainer__toptoolbar'></div>
      <div class = 'videocontainer__toolbar'></div>
      <div class = 'videocontainer__hoverOverlay'></div>
      <div class = 'displayNameContainer'></div>
      <div class = 'avatar-container'></div>
      <div class ='presence-label-container'></div>
      <span class = 'remotevideomenu'></span>`;

  const remoteVideosContainer
      = document.getElementById('classroomRemoteVideo');

  remoteVideosContainer.appendChild(container);

  return container;
}


export default class RemoteVideo extends SeatVideo {
    /**
     * Creates new instance of the <tt>RemoteVideo</tt>.
     * @param user {JitsiParticipant} the user for whom remote video instance will
     * be created.
     * @constructor
     */
    constructor(user, SeatLayout) {
        super()
        this.user = user
        this.SeatLayout = SeatLayout
        this.addRemoteVideoContainer();
    }

    /**
     *
     */
    addRemoteVideoContainer() {
        this.container = createContainer(this.videoSpanId);
        this.$container = $(this.container);
        this._setThumbnailSize();

        return this.container;
    }

    updateView(){
        
    }
    
    /**
     * Removes RemoteVideo from the page.
     */
    remove() {
        super.remove();
    }
    
    /**
     *
     * @param {*} stream
     */
    addRemoteStreamElement(stream) {
        if (!this.container) {
            logger.debug('Not attaching remote stream due to no container');

            return;
        }
        const isVideo = stream.isVideoTrack();
        isVideo ? this.videoStream = stream : this.audioStream = stream;

        if (!stream.getOriginalStream()) {
            logger.debug('Remote video stream has no original stream');

            return;
        }
        let streamElement = SeatVideo.createStreamElement(stream);

        // Put new stream element always in front
        streamElement = UIUtils.prependChild(this.container, streamElement);
        $(streamElement).hide();

        this.waitForPlayback(streamElement, stream);
        stream.attach(streamElement);
        if (!isVideo) {
            this._audioStreamElement = streamElement;
        }
    }
    
      /**
     * Removes the remote stream element corresponding to the given stream and
     * parent container.
     *
     * @param stream the MediaStream
     * @param isVideo <tt>true</tt> if given <tt>stream</tt> is a video one.
     */
    removeRemoteStreamElement(stream) {
        if (!this.container) {
            return false;
        }

        const isVideo = stream.isVideoTrack();
        const elementID = SeatVideo.getStreamElementID(stream);
        const select = $(`#${elementID}`);

        select.remove();
        if (isVideo) {
            this._canPlayEventReceived = false;
        }

        logger.info(`${isVideo ? 'Video' : 'Audio'} removed ${this.id}`, select);

        if (stream === this.videoStream) {
            this.videoStream = null;
        }

        this.updateView();
    }

    /**
     *
     * @param {*} streamElement
     * @param {*} stream
     */
    waitForPlayback(streamElement, stream) {
        const webRtcStream = stream.getOriginalStream();
        const isVideo = stream.isVideoTrack();

        if (!isVideo || webRtcStream.id === 'mixedmslabel') {
            return;
        }

        const listener = () => {
            this._canPlayEventReceived = true;
            this.SeatLayout.remoteVideoActive(streamElement, this.id);
            streamElement.removeEventListener('canplay', listener);

            // Refresh to show the video
            this.updateView();
        };

        streamElement.addEventListener('canplay', listener);
    }

}