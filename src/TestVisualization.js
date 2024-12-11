"use strict";

/**
 * About TestVisualization:
 *  setRMBTTest expects a object that implements {RMBTIntermediateResult}.getIntermediateResult()
 *      this will be called every xx ms (pull)
 *  The Animation loop will start as soon as "startTest()" is called
 *  The status can be set directly via setStatus or in the intermediateResult
 *  Information (provider, ip, uuid, etc.) has to be set via updateInformation
 *  As soon as the test reaches the "End"-State, the result page is called
 */
var TestVisualization = (function () {

    function TestVisualization(successCallback, errorCallback) {
        this.successCallback = successCallback;
        this.errorCallback = errorCallback;
    }

    /**
     * Sets the RMBT Test object
     * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
     */
    TestVisualization.prototype.setRMBTTest = function (rmbtTest) {

    };

    /**
     * Will be called from Websockettest as soon as this information is available
     * @param serverName
     * @param remoteIp
     * @param providerName
     * @param testUUID
     */
    TestVisualization.prototype.updateInfo = function (serverName, remoteIp, providerName, testUUID, openTestUUID) {

    };


    /**
     * Will be called from Websockettest as soon as the current status changes
     * @param status
     */
    TestVisualization.prototype.setStatus = function (status) {
        if (status === "ERROR" || status === "ABORTED") {
            if (this.errorCallback) {
                var t = this.errorCallback;
                this.errorCallback = null;
                t();
            }
        } else if (status === "END") {
            // call callback that the test is finished
            if (_successCallback !== null) {
                var t = this.successCallback;
                this.successCallback = null;
                t();
            }
        }
    };

    /**
     * Will be called from GeoTracker as soon as a location is available
     * @param latitude
     * @param longitude
     */
    TestVisualization.prototype.setLocation = function (latitude, longitude) {

    };

    /**
     * Starts visualization
     */
    TestVisualization.prototype.startTest = function () {

    };

    return TestVisualization;
})();
