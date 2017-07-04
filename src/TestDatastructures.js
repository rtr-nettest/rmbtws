"use strict";

const TestEnvironment = (function () {
    let testVisualization = null;
    let geoTracker = null;

    return {
        /**
         * gets the TestVisualization or null
         * @returns {TestVisualization}
         */
        getTestVisualization: function () {
            return testVisualization;
        },

        /**
         * gets the GeoTracker or null
         * @returns {GeoTracker}
         */
        getGeoTracker: function () {
            return geoTracker;
        },

        init: function (tVisualization, gTracker) {
            if (typeof tVisualization === 'undefined') {
                tVisualization = new TestVisualization();
            }
            if (typeof gTracker === 'undefined') {
                gTracker = new GeoTracker();
            }
            testVisualization = tVisualization;
            geoTracker = gTracker;
        }
    };
})();


//States
const TestState = {
    WAIT: "WAIT",
    INIT: "INIT",
    INIT_DOWN: "INIT_DOWN",
    PING: "PING",
    DOWN: "DOWN",
    INIT_UP: "INIT_UP",
    UP: "UP",
    END: "END",
    ERROR: "ERROR",
    ABORTED: "ABORTED",
    LOCATE: "LOCATE",
    LOCABORTED: "LOCABORTED",
    SPEEDTEST_END: "SPEEDTEST_END",
    QOS_TEST_RUNNING: "QOS_TEST_RUNNING",
    QOS_END: "QOS_END"
};

//Intermediate Result
function RMBTIntermediateResult() { }
RMBTIntermediateResult.prototype.setLogValues = function () {
    const toLog = function (value) {
        if (value < 10000) {
            return 0;
        }
        return (2.0 + Math.log((value / 1e6) / Math.LN10)) / 4.0;
    };
    this.downBitPerSecLog = toLog(downBitPerSec);
    this.upBitPerSecLog = toLog(upBitPerSec);
};

RMBTIntermediateResult.prototype.pingNano = -1;
RMBTIntermediateResult.prototype.downBitPerSec = -1;
RMBTIntermediateResult.prototype.upBitPerSec = -1;
RMBTIntermediateResult.prototype.status = TestState.INIT;
RMBTIntermediateResult.prototype.progress = 0;
RMBTIntermediateResult.prototype.downBitPerSecLog = -1;
RMBTIntermediateResult.prototype.upBitPerSecLog = -1;
RMBTIntermediateResult.prototype.remainingWait = -1;

