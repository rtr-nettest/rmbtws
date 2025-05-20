"use strict";

export let RMBTTestConfig = (function () {
    RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.language;
    RMBTTestConfig.prototype.uuid = "";
    RMBTTestConfig.prototype.type = "DESKTOP";
    RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
    RMBTTestConfig.prototype.client_software_version = "0.9.3";
    RMBTTestConfig.prototype.os_version = 1;
    RMBTTestConfig.prototype.platform = "RMBTws";
    RMBTTestConfig.prototype.model = "Websocket";
    RMBTTestConfig.prototype.product = "Chrome";
    RMBTTestConfig.prototype.client = "RMBTws";
    RMBTTestConfig.prototype.timezone = "Europe/Vienna";
    RMBTTestConfig.prototype.controlServerURL;
    RMBTTestConfig.prototype.controlServerRegistrationResource = "/testRequest";
    RMBTTestConfig.prototype.controlServerResultResource = "/result";
    RMBTTestConfig.prototype.controlServerDataCollectorResource = "/requestDataCollector";
//?!? - from RMBTTestParameter.java
    RMBTTestConfig.prototype.pretestDurationMs = 2000;
    RMBTTestConfig.prototype.savedChunks = 4; //4*4 + 4*8 + 4*16 + ... + 4*MAX_CHUNK_SIZE -> O(8*MAX_CHUNK_SIZE)
    RMBTTestConfig.prototype.measurementPointsTimespan = 40; //1 measure point every 40 ms
    RMBTTestConfig.prototype.numPings = 10; //do 10 pings
    RMBTTestConfig.prototype.doPingIntervalMilliseconds = -1; //if enabled, ping tests will be conducted until the time limit is reached (min numPings)
//max used threads for this test phase (upper limit: RegistrationResponse)
    RMBTTestConfig.prototype.downloadThreadsLimitsMbit = {
        0: 1,
        1: 3,
        100: 5
    };
    RMBTTestConfig.prototype.uploadThreadsLimitsMbit = {
        0: 1,
        30: 2,
        80: 3,
        150: 5
    };
    RMBTTestConfig.prototype.userServerSelection = ((typeof globalThis.userServerSelection !== 'undefined') ? userServerSelection : 0); //for QoSTest
    RMBTTestConfig.prototype.additionalRegistrationParameters = {}; //will be transmitted in ControlServer registration, if any
    RMBTTestConfig.prototype.additionalSubmissionParameters = {}; //will be transmitted in ControlServer result submission, if any

    function RMBTTestConfig(language, controlProxy, wsPath) {
        this.language = language;
        this.controlServerURL = controlProxy + "/" + wsPath;

        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) {
            //we are based in Vienna :-)
            this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace("Europe/Berlin","Europe/Vienna");
        }
    }

    return RMBTTestConfig;
}());


let RMBTControlServerRegistrationResponse = (function() {
        RMBTControlServerRegistrationResponse.prototype.client_remote_ip;
        RMBTControlServerRegistrationResponse.prototype.provider;
        RMBTControlServerRegistrationResponse.prototype.test_server_encryption = "";
        RMBTControlServerRegistrationResponse.prototype.test_numthreads;
        RMBTControlServerRegistrationResponse.prototype.test_server_name;
        RMBTControlServerRegistrationResponse.prototype.test_uuid;
        RMBTControlServerRegistrationResponse.prototype.test_id;
        RMBTControlServerRegistrationResponse.prototype.test_token;
        RMBTControlServerRegistrationResponse.prototype.test_server_address;
        RMBTControlServerRegistrationResponse.prototype.test_duration;
        RMBTControlServerRegistrationResponse.prototype.result_url;
        RMBTControlServerRegistrationResponse.prototype.test_wait;
        RMBTControlServerRegistrationResponse.prototype.test_server_port;
//test
        function RMBTControlServerRegistrationResponse(data) {
            Object.assign(this, data);
            this.test_duration = parseInt(data.test_duration);
        }

        return RMBTControlServerRegistrationResponse;
})();

/**
 * Control structure for a single websocket-test thread
 * @param {CyclicBarrier} cyclicBarrier
 * @returns {RMBTTestThread}
 */
function RMBTTestThread(cyclicBarrier) {

    let _logger = log.getLogger("rmbtws");
    let _callbacks = {};
    let _cyclicBarrier = cyclicBarrier;

    return {
        /**
         * Sets the state of the thread; triggers state transition callbacks
         * if there are any as soon as all threads in the cyclicbarrier reached
         * the state
         * @param {TestState} state
         */
        setState: function(state) {
            this.state = state;
            _logger.debug(this.id + ": reached state: " + state);
            let that = this;
            _cyclicBarrier.await(function() {
                _logger.debug(that.id + ": all threads reached state: " + state);
                if (_callbacks[state] !== undefined && _callbacks[state] !== null) {
                    let callback = _callbacks[state];
                    //_callbacks[state] = null;
                    callback();
                } else {
                    _logger.info(that.id + ": no callback registered for state: " + state);
                }
            });

        },

        /**
         * Links a callback function to the state change
         * @param {TestState} state
         * @param {Function} callback the function that is called on state enter
         */
        onStateEnter: function(state, callback) {
            _callbacks[state] = callback;
        },

        retriggerState : function() {
            //trigger state again since we received an 'ERROR'-Message
            setState(this.state);
        },

        /**
         * Triggers the next state in the thread
         */
        triggerNextState: function() {
            let states = [TestState.INIT, TestState.INIT_DOWN, TestState.PING,
                TestState.DOWN, TestState.CONNECT_UPLOAD, TestState.INIT_UP, TestState.UP, TestState.END];
            if (this.state !== TestState.END) {
                let nextState = states[states.indexOf(this.state) + 1];
                _logger.debug(this.id + ": triggered state " + nextState);
                this.setState(nextState);
            }
        },
        id: -1,
        socket: null,
        result: new RMBTThreadTestResult()

    };
}


function RMBTTestResult() {
    this.pings = [];
    this.speedItems = [];
    this.threads = [];
}
RMBTTestResult.prototype.addThread = function(rmbtThreadTestResult) {
    this.threads.push(rmbtThreadTestResult);
};
RMBTTestResult.prototype.ip_local = null;
RMBTTestResult.prototype.ip_server = null;
RMBTTestResult.prototype.port_remote = null;
RMBTTestResult.prototype.num_threads = null;
RMBTTestResult.prototype.encryption = "NONE";
RMBTTestResult.prototype.ping_shortest = -1;
RMBTTestResult.prototype.ping_median = -1;
RMBTTestResult.prototype.client_version = null;
RMBTTestResult.prototype.pings = [];
RMBTTestResult.prototype.speed_download = -1;
RMBTTestResult.prototype.speed_upload = -1;
RMBTTestResult.prototype.speedItems = [];
RMBTTestResult.prototype.bytes_download = -1;
RMBTTestResult.prototype.nsec_download = -1;
RMBTTestResult.prototype.bytes_upload = -1;
RMBTTestResult.prototype.nsec_upload = -1;
RMBTTestResult.prototype.totalDownBytes = -1;
RMBTTestResult.prototype.totalUpBytes = -1;
RMBTTestResult.prototype.beginTime = -1;
RMBTTestResult.prototype.geoLocations = [];
RMBTTestResult.calculateOverallSpeedFromMultipleThreads = (threads, phaseResults) => {
    //TotalTestResult.java:118 (Commit 7d5519ce6ad9121896866d4d8f30299c7c19910d)
    let numThreads = threads.length;
    let targetTime = Infinity;

    for (let i = 0; i < numThreads; i++) {
        const nsecs = phaseResults(threads[i]);
        if (nsecs.length > 0) {
            if (nsecs[nsecs.length - 1].duration < targetTime) {
                targetTime = nsecs[nsecs.length - 1].duration;
            }
        }
    }

    let totalBytes = 0;

    for (let i = 0; i < numThreads; i++) {
        const thread = threads[i];
        const phasedThread = phaseResults(thread);
        const phasedLength = phasedThread.length;

        if (thread !== null && phasedLength > 0) {
            let targetIdx = phasedLength;
            for (let j = 0; j < phasedLength; j++) {
                if (phasedThread[j].duration >= targetTime) {
                    targetIdx = j;
                    break;
                }
            }
            let calcBytes;
            if (phasedThread[targetIdx].duration === targetTime) {
                // nsec[max] == targetTime
                calcBytes = phasedThread[phasedLength - 1].bytes;
            } else {
                const bytes1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].bytes;
                const bytes2 = phasedThread[targetIdx].bytes;
                const bytesDiff = bytes2 - bytes1;
                const nsec1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].duration;
                const nsec2 = phasedThread[targetIdx].duration;
                const nsecDiff = nsec2 - nsec1;
                const nsecCompensation = targetTime - nsec1;
                const factor = nsecCompensation / nsecDiff;
                let compensation = Math.round(bytesDiff * factor);

                if (compensation < 0) {
                    compensation = 0;
                }
                calcBytes = bytes1 + compensation;
            }
            totalBytes += calcBytes;
        }
    }

    return {
        bytes: totalBytes,
        nsec: targetTime,
        speed: (totalBytes * 8) / (targetTime / 1e9)
    };
};

RMBTTestResult.prototype.calculateAll = function() {
    //speed items down
    for (let i = 0; i < this.threads.length; i++) {
        let down = this.threads[i].down;
        if (down.length > 0) {
            for (let j = 0; j < down.length; j++) {
                this.speedItems.push({
                    direction: "download",
                    thread: i,
                    time: down[j].duration,
                    bytes: down[j].bytes
                });
            }
        }
    }

    let total = 0;
    let targetTime = Infinity;

    //down
    let results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
        return thread.down;
    });
    this.speed_download = results.speed / 1e3; //bps -> kbps
    this.bytes_download = results.bytes;
    this.nsec_download = results.nsec;

    //speed items up
    for (let i = 0; i < this.threads.length; i++) {
        let up = this.threads[i].up;
        if (up.length > 0) {
            for (let j = 0; j < up.length; j++) {
                this.speedItems.push({
                    direction: "upload",
                    thread: i,
                    time: up[j].duration,
                    bytes: up[j].bytes
                });
            }
        }
    }

    //up
    results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
        return thread.up;
    });
    this.speed_upload = results.speed / 1e3; //bps -> kbps
    this.bytes_upload = results.bytes;
    this.nsec_upload = results.nsec;

    //ping
    let pings = this.threads[0].pings;
    let pingsResult = [];
    for (let i = 0; i < pings.length; i++) {
        pingsResult.push({
           value: pings[i].client,
           value_server: pings[i].server,
           time_ns: pings[i].timeNs
        });
    }
    this.pings = pingsResult;

    //add time_ns to geoLocations
    for (let i=0;i<this.geoLocations.length;i++) {
        let geoLocation = this.geoLocations[i];
        geoLocation['time_ns'] = (geoLocation.tstamp - this.beginTime) * 1e6;
    }
};



function RMBTThreadTestResult() {
    this.down = []; //map of bytes/nsec
    this.up = [];
    this.pings = [];
}
//no inheritance(other than in Java RMBTClient)
//RMBTThreadTestResult.prototype = new RMBTTestResult();
RMBTThreadTestResult.prototype.down = null;
RMBTThreadTestResult.prototype.up = null;
RMBTThreadTestResult.prototype.pings = null;
RMBTThreadTestResult.prototype.totalDownBytes = -1;
RMBTThreadTestResult.prototype.totalUpBytes = -1;

function RMBTPingResult() {}
RMBTPingResult.prototype.client = -1;
RMBTPingResult.prototype.server = -1;
RMBTPingResult.prototype.timeNs = -1;

/**
 * @callback RMBTControlServerRegistrationResponseCallback
 * @param {RMBTControlServerRegistrationResponse} json
 */
const RMBTError = {
    NOT_SUPPORTED : "WebSockets are not supported",
    SOCKET_INIT_FAILED : "WebSocket initialization failed",
    CONNECT_FAILED : "connection to test server failed",
    SUBMIT_FAILED : "Error during submission of test results",
    REGISTRATION_FAILED : "Error during test registration"
};
