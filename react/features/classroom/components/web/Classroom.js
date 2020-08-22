// @flow

import _ from 'lodash';
import React from 'react';

import { getConferenceNameForTitle } from '../../../base/conference';
import { translate } from '../../../base/i18n';
import { connect as reactReduxConnect } from '../../../base/redux';
import { connect, disconnect } from '../../../base/connector';
import {
    AbstractConference,
    abstractMapStateToProps
} from '../AbstractConference';
import type { AbstractProps } from '../AbstractConference';

declare var APP: Object;
declare var config: Object;
declare var interfaceConfig: Object;

/**
 * The type of the React {@code Component} props of {@link Conference}.
 */
type Props = AbstractProps & {

  /**
     * Name for this conference room.
     */
    _roomName: string,

    dispatch: Function,

    t: Function
}

/**
 * The conference page of the Web application.
 */
class Conference extends AbstractConference<Props, *> {

    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);

    }

    /**
     * Start the connection and get the UI ready for the conference.
     *
     * @inheritdoc
     */
    componentDidMount() {
      document.title = `${this.props._roomName} | ${interfaceConfig.APP_NAME}`;
      this._start();
    }

    /**
     * Disconnect from the conference when component will be
     * unmounted.
     *
     * @inheritdoc
     */
    componentWillUnmount() {
      APP.classroom.isJoined() && this.props.dispatch(disconnect());
    }

    _start() {
      APP.classroomUI.start();
      const { dispatch, t } = this.props;
      
      dispatch(connect());
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
       return (
         <div id="classroom_page">
           <div className="classroom_page-seat">

           </div>
           <div className="classroom_page-board"></div>
         </div>
       )
    }

    
}

/**
 * Maps (parts of) the Redux state to the associated props for the
 * {@code Conference} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {Props}
 */
function _mapStateToProps(state) {
    return {
        ...abstractMapStateToProps(state),
        _roomName: getConferenceNameForTitle(state),
    };
}

export default reactReduxConnect(_mapStateToProps)(translate(Conference));
