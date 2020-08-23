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
      const width = 112
      const height = 84
      this.$container.css({
        height: `${height}px`,
        'min-height': `${height}px`,
        'min-width': `${width}px`,
        width: `${width}px`
    });
    }
}