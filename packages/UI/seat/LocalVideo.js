import {
    VideoTrack
} from '../../../react/features/base/media';
import React, {
    Component
} from 'react';
import ReactDOM from 'react-dom';
import {
    Provider
} from 'react-redux';
import {
    getLocalVideoTrack
} from '../../../react/features/base/tracks';
import SeatVideo from './SeatVideo';

export default class LocalVideo extends SeatVideo{

    constructor() {
        super()
        this.videoSpanId = 'localVideoContainer';
        this.container = this.createContainer();
        this.$container = $(this.container);
        this._setThumbnailSize();
        this.updateDOMLocation();
    }

    createContainer() {
        const containerSpan = document.createElement('div');

        containerSpan.classList.add('videocontainer');
        containerSpan.id = this.videoSpanId;

        containerSpan.innerHTML = `
            <div class = 'videocontainer__background'></div>
            <span id = 'localVideoWrapper'></span>
            <div class = 'videocontainer__toolbar'></div>
            <div class = 'videocontainer__toptoolbar'></div>
            <div class = 'videocontainer__hoverOverlay'></div>
            <div class = 'displayNameContainer'></div>
            <div class = 'avatar-container'></div>`;

        return containerSpan;
    }

 

    /**
     * Places the {@code LocalVideo} in the DOM based on the current video layout.
     *
     * @returns {void}
     */
    updateDOMLocation() {
        if (!this.container) {
            return;
        }
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }

        const appendTarget = document.getElementById('classroomLocalVideo');

        appendTarget && appendTarget.appendChild(this.container);
        this._updateVideoElement();
    }


    changeVideo(stream) {
        this.videoStream = stream;
        this.localVideoId = `localVideo_${stream.getId()}`;
        this._updateVideoElement();
    }

    /**
     * Renders the React Element for displaying video in {@code LocalVideo}.
     *
     */
    _updateVideoElement() {
        const localVideoContainer = document.getElementById('localVideoWrapper');
        const videoTrack
            = getLocalVideoTrack(APP.store.getState()['features/base/tracks']);

        ReactDOM.render(
            <Provider store = { APP.store }>
                <VideoTrack
                    id = 'localVideo_container'
                    videoTrack = { videoTrack } />
            </Provider>,
            localVideoContainer
        );

        // Ensure the video gets play() called on it. This may be necessary in the
        // case where the local video container was moved and re-attached, in which
        // case video does not autoplay. Also, set the playsinline attribute on the
        // video element so that local video doesn't open in full screen by default
        // in Safari browser on iOS.
        const video = this.container.querySelector('video');

        video && video.setAttribute('playsinline', 'true');
        video && !config.testing?.noAutoPlayVideo && video.play();
    }
}