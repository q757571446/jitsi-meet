import SeatVideo from "./SeatVideo";


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
    constructor(user) {
        super()
        this.user = user
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
    

}