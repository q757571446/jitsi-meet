import messageHandler from './util/MessageHandler';

const UI = {}

UI.start = function() {

}

/**
 * Notify user that connection failed.
 * @param {string} stropheErrorMsg raw Strophe error message
 */
UI.notifyConnectionFailed = function(stropheErrorMsg) {
  let descriptionKey;
  let descriptionArguments;

  if (stropheErrorMsg) {
      descriptionKey = 'dialog.connectErrorWithMsg';
      descriptionArguments = { msg: stropheErrorMsg };
  } else {
      descriptionKey = 'dialog.connectError';
  }

  messageHandler.showError({
      descriptionArguments,
      descriptionKey,
      titleKey: 'connection.CONNFAIL'
  });
};

/**
 * Show local video stream on UI.
 * @param {JitsiTrack} track stream to show
 */
UI.addLocalVideoStream = track => {
  
};

/**
 * Sets muted video state for participant
 */
UI.setVideoMuted = function(id, muted) {
  // VideoLayout.onVideoMute(id, muted);
  // if (APP.conference.isLocalId(id)) {
  //     APP.conference.updateVideoIconEnabled();
  // }
};

/**
 * Sets muted audio state for participant
 */
UI.setAudioMuted = function(id, muted) {
  // VideoLayout.onAudioMute(id, muted);
  // if (APP.conference.isLocalId(id)) {
  //     APP.conference.updateAudioIconEnabled();
  // }
};

/**
 * Notify user that reservation error happened.
 */
UI.notifyReservationError = function(code, msg) {
  messageHandler.showError({
      descriptionArguments: {
          code,
          msg
      },
      descriptionKey: 'dialog.reservationErrorMsg',
      titleKey: 'dialog.reservationError'
  });
};

/**
 * Notify user that server has shut down.
 */
UI.notifyGracefulShutdown = function() {
  messageHandler.showError({
      descriptionKey: 'dialog.gracefulShutdown',
      titleKey: 'dialog.serviceUnavailable'
  });
};


UI.notifyFocusDisconnected = function(focus, retrySec) {
  messageHandler.participantNotification(
      null, 'notify.focus',
      'disconnected', 'notify.focusFail',
      { component: focus,
          ms: retrySec }
  );
};

/**
 * Notify user that maximum users limit has been reached.
 */
UI.notifyMaxUsersLimitReached = function() {
  messageHandler.showError({
      hideErrorSupportLink: true,
      descriptionKey: 'dialog.maxUsersLimitReached',
      titleKey: 'dialog.maxUsersLimitReachedTitle'
  });
};



export default UI