"use strict";

function RMBTTestConfig() { };
RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
RMBTTestConfig.prototype.language = selectedLanguage;
RMBTTestConfig.prototype.uuid = "";
RMBTTestConfig.prototype.type = "DESKTOP";
RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
RMBTTestConfig.prototype.client_software_version = "0.6.1";
RMBTTestConfig.prototype.os_version = 1;
RMBTTestConfig.prototype.platform = "RMBTws";
RMBTTestConfig.prototype.model = "Websocket";
RMBTTestConfig.prototype.product = "Chrome";
RMBTTestConfig.prototype.client = "RMBTws";
RMBTTestConfig.prototype.timezone = "Europe/Vienna"; //@TODO
RMBTTestConfig.prototype.controlServerURL = controlProxy+"/"+wspath;
RMBTTestConfig.prototype.controlServerRegistrationResource = "/testRequest";
RMBTTestConfig.prototype.controlServerResultResource = "/result";
RMBTTestConfig.prototype.controlServerDataCollectorResource = "/requestDataCollector";
//?!? - from RMBTTestParameter.java
RMBTTestConfig.prototype.pretestDurationMs = 2000;
RMBTTestConfig.prototype.savedChunks = 100; //0,4 MiB
RMBTTestConfig.prototype.measurementPointsTimespan = 40; //1 measure point every 40 ms
RMBTTestConfig.prototype.fallbackBytesDownload = 48; //12*4 = 48 KBytes in 2 Secs
RMBTTestConfig.prototype.fallbackBytessUpload = 48; //
RMBTTestConfig.prototype.numPings = 10; //do 10 pings
RMBTTestConfig.prototype.limitUploadThreads = (getParam !== undefined && getParam("allowUploadThreads") !== false)?false:true;
RMBTTestConfig.prototype.userServerSelection = ((typeof window.userServerSelection !== 'undefined')?userServerSelection:0); //for QoSTest


var RMBTControlServerRegistrationResponse = (function() {
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

        function RMBTControlServerRegistrationResponse(data) {
                this.client_remote_ip = data.client_remote_ip;
                this.provider = data.provider;
                this.test_server_encryption = data.test_server_encryption;
                this.test_numthreads = data.test_numthreads;
                this.test_server_name = data.test_server_name;
                this.test_uuid = data.test_uuid;
                this.test_id = data.test_id;
                this.test_token = data.test_token;
                this.test_server_address = data.test_server_address;
                this.test_duration = parseInt(data.test_duration);
                this.result_url = data.result_url;
                this.test_wait = data.test_wait;
                this.test_server_port = data.test_server_port;
        }

        return RMBTControlServerRegistrationResponse;
})();

/**
 * Control structur for a single websocket-test thread
 * @param {CyclicBarrier} cyclicBarrier
 * @returns {RMBTTestThread}
 */
function RMBTTestThread(cyclicBarrier) {
    var _callbacks = {};
    var _cyclicBarrier = cyclicBarrier;

    return {
        /**
         * Sets the state of the thread; triggers state transition callbacks
         * if there are any as soon as all threads in the cyclicbarrier reached
         * the state
         * @param {TestState} state
         */
        setState: function(state) {
            this.state = state;
            debug(this.id + ": reached state: " + state);
            var that = this;
            _cyclicBarrier.await(function() {
                debug(that.id + ": all threads reached state: " + state);
                if (_callbacks[state] !== undefined &&
                        _callbacks[state] !== null) {
                    var callback = _callbacks[state];
                    //_callbacks[state] = null;
                    callback();
                }
                else {
                    debug(that.id + ": no callback registered");
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
            var states = [TestState.INIT, TestState.INIT_DOWN, TestState.PING,
                TestState.DOWN, TestState.INIT_UP, TestState.UP, TestState.END];
            if (this.state !== TestState.END) {
                var nextState = states[states.indexOf(this.state) + 1];
                debug(this.id + ": triggered state " + nextState);
                this.setState(nextState);
            }
        },
        id: -1,
        socket: null,
        result: new RMBTThreadTestResult()

    };
}
;

function RMBTTestResult() {
    this.pings = new Array();
    this.speedItems = new Array();
    this.threads = new Array();
};
RMBTTestResult.prototype.addThread = function(rmbtThreadTestResult) {
    this.threads.push(rmbtThreadTestResult);
};
RMBTTestResult.prototype.ip_local;
RMBTTestResult.prototype.ip_server;
RMBTTestResult.prototype.port_remote;
RMBTTestResult.prototype.num_threads;
RMBTTestResult.prototype.encryption = "NONE";
RMBTTestResult.prototype.ping_shortest =-1;
RMBTTestResult.prototype.ping_median = -1;
RMBTTestResult.prototype.client_version;
RMBTTestResult.prototype.pings = new Array();
RMBTTestResult.prototype.speed_download = -1;
RMBTTestResult.prototype.speed_upload = -1;
RMBTTestResult.prototype.speedItems = new Array();
RMBTTestResult.prototype.bytes_download = -1;
RMBTTestResult.prototype.nsec_download = -1;
RMBTTestResult.prototype.bytes_upload = -1;
RMBTTestResult.prototype.nsec_upload = -1;
RMBTTestResult.prototype.totalDownBytes = -1;
RMBTTestResult.prototype.totalUpBytes = -1;
RMBTTestResult.prototype.beginTime = -1;
RMBTTestResult.prototype.geoLocations = new Array();
RMBTTestResult.prototype.calculateAll = function() {
    //TotalTestResult.java:118 (Commit 7d5519ce6ad9121896866d4d8f30299c7c19910d)
    var calculate = function(threads, phaseResults) {
        var numThreads = threads.length;
        var targetTime = Infinity;
        for (var i = 0; i < numThreads; i++)
        {
            var nsecs = phaseResults(threads[i]);
            if (nsecs.length > 0) {
                if (nsecs[nsecs.length - 1].duration < targetTime) {
                    targetTime = nsecs[nsecs.length - 1].duration;
                }
            }
        }

        var totalBytes = 0;

        for (var i = 0; i < numThreads; i++)
        {
            var thread = threads[i];
            if (thread !== null && phaseResults(thread).length > 0)
            {

                var targetIdx = phaseResults(thread).length;
                for (var j = 0; j < phaseResults(thread).length; j++)
                    if (phaseResults(thread)[j].duration > targetTime)
                    {
                        targetIdx = j;
                        break;
                    }
                var calcBytes;
                if (targetIdx === phaseResults(thread).length)
                    // nsec[max] == targetTime
                    calcBytes = phaseResults(thread)[phaseResults(thread).length - 1].bytes;
                else
                {
                    var bytes1 = targetIdx === 0 ? 0 : phaseResults(thread)[targetIdx - 1].bytes;
                    var bytes2 = phaseResults(thread)[targetIdx].bytes;
                    var bytesDiff = bytes2 - bytes1;
                    var nsec1 = targetIdx === 0 ? 0 : phaseResults(thread)[targetIdx - 1].duration;
                    var nsec2 = phaseResults(thread)[targetIdx].duration;
                    var nsecDiff = nsec2 - nsec1;
                    var nsecCompensation = targetTime - nsec1;
                    var factor = nsecCompensation / nsecDiff;
                    var compensation = Math.round(bytesDiff * factor);
                    if (compensation < 0)
                        compensation = 0;
                    calcBytes = bytes1 + compensation;
                }
                totalBytes += calcBytes;
            }
        }


        return {
            bytes: totalBytes,
            nsec: targetTime,
            speed: (totalBytes*8) / (targetTime / 1e9) / 1e3
        };
    };

    //speed items down
    for (var i=0;i<this.threads.length;i++) {
        var down = this.threads[i].down;
        if (down.length > 0) {
            for (var j = 0; j < down.length; j++) {
                this.speedItems.push({
                    direction: "download",
                    thread: i,
                    time: down[j].duration,
                    bytes: down[j].bytes
                });
            }
        }
    }

    var total = 0;
    var targetTime = Infinity;

    //down
    var results = calculate(this.threads, function (thread) {
        return thread.down;
    });
    this.speed_download = results.speed;
    this.bytes_download = results.bytes;
    this.nsec_download = results.nsec;


    //speed items up
    for (var i=0;i<this.threads.length;i++) {
        var up = this.threads[i].up;
        if (up.length > 0) {
            for (var j = 0; j < up.length; j++) {
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
    var results = calculate(this.threads, function (thread) {
        return thread.up;
    });
    this.speed_upload = results.speed;
    this.bytes_upload = results.bytes;
    this.nsec_upload = results.nsec;

    //ping
    var pings = this.threads[0].pings;
    var shortest = Infinity;
    for (var i=0;i<pings.length;i++) {
        this.pings.push({
           value: pings[i].client,
           value_server: pings[i].server,
           time_ns: pings[i].timeNs
        });

        if (pings[i].client < shortest) {
            shortest = pings[i].client;
        }
    }
    this.ping_shortest = shortest;
};



function RMBTThreadTestResult() {
    this.down = new Array(); //map of bytes/nsec
    this.up = new Array();
    this.pings = new Array();
};
//no inheritance(other than in Java RMBTClient)
//RMBTThreadTestResult.prototype = new RMBTTestResult();
RMBTThreadTestResult.prototype.down;
RMBTThreadTestResult.prototype.up;
RMBTThreadTestResult.prototype.pings;
RMBTThreadTestResult.prototype.totalDownBytes = -1;
RMBTThreadTestResult.prototype.totalUpBytes = -1;

function RMBTPingResult() {}
RMBTPingResult.prototype.client =-1;
RMBTPingResult.prototype.server =-1;
RMBTPingResult.prototype.timeNs =-1;

/**
 * @callback RMBTControlServerRegistrationResponseCallback
 * @param {RMBTControlServerRegistrationResponse} json
 */


var RMBTError = {
    NOT_SUPPORTED : "WebSockets are not supported",
    SOCKET_INIT_FAILED : "WebSocket initialization failed",
    CONNECT_FAILED : "connecting to test server failed"
};
