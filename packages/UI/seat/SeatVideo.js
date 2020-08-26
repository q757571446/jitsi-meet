export default class SeatVideo {

    /**
     * Selects the HTML image element which displays user's avatar.
     *
     * @return {jQuery|HTMLElement} a jQuery selector pointing to the HTML image
     * element which displays the user's avatar.
     */
    $avatar() {
        return this.$container.find('.avatar-container');
    }
    /**
     * Sets the size of the thumbnail.
     */
    _setThumbnailSize() {
        const state = APP.store.getState();
        let layoutSize = state['features/video-layout'].layoutSize;
        console.log('>>>>>>>>>layoutSize1', layoutSize)
        const width = 112
        const height = 84
        this.$container.css({
            height: `${height}px`,
            'min-height': `${height}px`,
            'min-width': `${width}px`,
            width: `${width}px`
        });
    }

    /**
     * Cleans up components on {@code SmallVideo} and removes itself from the DOM.
     *
     * @returns {void}
     */
    remove() {
        // Remove whole container
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

      /**
     * Creates an audio or video element for a particular MediaStream.
     */
    static createStreamElement(stream) {
        const isVideo = stream.isVideoTrack();
        const element = isVideo ? document.createElement('video') : document.createElement('audio');

        if (isVideo) {
            element.setAttribute('muted', 'true');
            element.setAttribute('playsInline', 'true'); /* for Safari on iOS to work */
        } else if (config.startSilent) {
            element.muted = true;
        }

        element.autoplay = !config.testing?.noAutoPlayVideo;
        element.id = SeatVideo.getStreamElementID(stream);

        return element;
    }

        /**
     * Returns the element id for a particular MediaStream.
     */
    static getStreamElementID(stream) {
        return (stream.isVideoTrack() ? 'remoteVideo_' : 'remoteAudio_') + stream.getId();
    }

}