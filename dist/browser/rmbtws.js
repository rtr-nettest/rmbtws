(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*!******************************************************************************
 * @license
 * Copyright 2015-2017 Thomas Schreiber
 * Copyright 2017-2019 Rundfunk und Telekom Regulierungs-GmbH (RTR-GmbH)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The source code for this project is available at
 * https://github.com/rtr-nettest/rmbtws
 *****************************************************************************!*/
"use strict";

/**
 * RMBTTest main object
 * @param {RMBTTestConfig} rmbtTestConfig
 * @param {RMBTControlServerCommunication} rmbtControlServer
 * @returns {}
 */

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.RMBTTest = RMBTTest;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function RMBTTest(rmbtTestConfig, rmbtControlServer) {
    var _server_override = "wss://developv4-rmbtws.netztest.at:19002";

    var _logger = log.getLogger("rmbtws");

    var _chunkSize = null;
    var MAX_CHUNK_SIZE = 4194304;
    var MIN_CHUNK_SIZE = 0;
    var DEFAULT_CHUNK_SIZE = 4096;
    var _changeChunkSizes = false;

    /**
     *  @type {RMBTTestConfig}
     **/
    var _rmbtTestConfig = void 0;

    /**
     * @type {RMBTControlServerCommunication}
     */
    var _rmbtControlServer = void 0;
    var _rmbtTestResult = null;
    var _errorCallback = null;
    var _stateChangeCallback = null;

    var _state = TestState.INIT;
    var _stateChangeMs = null;
    var _statesInfo = {
        durationInitMs: 2500,
        durationPingMs: 10000, //set dynamically
        durationUpMs: -1,
        durationDownMs: -1
    };

    var _intermediateResult = new RMBTIntermediateResult();

    var _threads = [];
    var _arrayBuffers = {};
    var _endArrayBuffers = {};

    var _cyclicBarrier = null;
    var _numThreadsAllowed = 0;
    var _numDownloadThreads = 0;
    var _numUploadThreads = 0;

    var _bytesPerSecsPretest = [];
    var _totalBytesPerSecsPretest = 0;

    //this is an observable/subject
    //http://addyosmani.com/resources/essentialjsdesignpatterns/book/#observerpatternjavascript
    //RMBTTest.prototype = new Subject();


    function construct(rmbtTestConfig, rmbtControlServer) {
        //init socket
        _rmbtTestConfig = rmbtTestConfig; // = new RMBTTestConfig();
        _rmbtControlServer = rmbtControlServer;
    }

    /**
     * Sets the state of the test, notifies the observers if
     * the state changed
     * @param {TestState} state
     */
    function setState(state) {
        if (_state === undefined || _state !== state) {
            _state = state;
            _stateChangeMs = nowMs();
            if (_stateChangeCallback) {
                _stateChangeCallback(state);
            }
        }
    }

    /**
     * Set the fallback function
     * in case the websocket-test
     * fails for any reason
     * @param {Function} fct
     */
    this.onError = function (fct) {
        _errorCallback = fct;
    };

    /**
     * Callback when the test changes execution state
     * @param {Function} callback
     */
    this.onStateChange = function (callback) {
        _stateChangeCallback = callback;
    };

    /**
     * Calls the error function (but only once!)
     * @param {RMBTError} error
     */
    var callErrorCallback = function callErrorCallback(error) {
        _logger.debug("error occurred during websocket test:", error);
        if (error !== RMBTError.NOT_SUPPORTED) {
            setState(TestState.ERROR);
        }
        if (_errorCallback !== null) {
            var t = _errorCallback;
            _errorCallback = null;
            t(error);
        }
    };

    this.startTest = function () {
        //see if websockets are supported
        if (window.WebSocket === undefined) {
            callErrorCallback(RMBTError.NOT_SUPPORTED);
            return;
        }

        setState(TestState.INIT);
        _rmbtTestResult = new RMBTTestResult();
        //connect to control server
        _rmbtControlServer.getDataCollectorInfo();

        _rmbtControlServer.obtainControlServerRegistration(function (response) {
            _numThreadsAllowed = parseInt(response.test_numthreads);
            _cyclicBarrier = new CyclicBarrier(_numThreadsAllowed);
            _statesInfo.durationDownMs = response.test_duration * 1e3;
            _statesInfo.durationUpMs = response.test_duration * 1e3;

            //@TODO: Nicer
            //if there is testVisualization, make use of it!
            if (TestEnvironment.getTestVisualization() !== null) {
                TestEnvironment.getTestVisualization().updateInfo(response.test_server_name, response.client_remote_ip, response.provider, response.test_uuid, response.open_test_uuid);
            }

            var continuation = function continuation() {
                _logger.debug("got geolocation, obtaining token and websocket address");

                //wait if we have to
                var continuation = function continuation() {
                    setState(TestState.INIT);
                    _rmbtTestResult.beginTime = Date.now();
                    //n threads
                    for (var i = 0; i < _numThreadsAllowed; i++) {
                        var thread = new RMBTTestThread(_cyclicBarrier);
                        thread.id = i;
                        _rmbtTestResult.addThread(thread.result);

                        //only one thread will call after upload is finished
                        conductTest(response, thread, function () {
                            _logger.info("All tests finished");
                            wsGeoTracker.stop();
                            _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
                            _rmbtTestResult.calculateAll();
                            _rmbtControlServer.submitResults(prepareResult(response), function () {
                                setState(TestState.END);
                            }, function () {
                                callErrorCallback(RMBTError.SUBMIT_FAILED);
                            });
                        });

                        _threads.push(thread);
                    }
                };

                if (response.test_wait === 0) {
                    continuation();
                } else {
                    _logger.info("test scheduled for start in " + response.test_wait + " second(s)");
                    setState(TestState.WAIT);
                    self.setTimeout(function () {
                        continuation();
                    }, response.test_wait * 1e3);
                }
            };

            var wsGeoTracker = void 0;
            //get the user's geolocation
            if (TestEnvironment.getGeoTracker() !== null) {
                wsGeoTracker = TestEnvironment.getGeoTracker();

                //in case of legacy code, the geoTracker will already be started
                continuation();
            } else {
                wsGeoTracker = new GeoTracker();
                _logger.debug("getting geolocation");
                wsGeoTracker.start(function () {
                    continuation();
                }, TestEnvironment.getTestVisualization());
            }
        }, function () {
            //no internet connection
            callErrorCallback(RMBTError.REGISTRATION_FAILED);
        });
    };

    /**
     *
     * @returns {RMBTIntermediateResult}
     */
    this.getIntermediateResult = function () {
        _intermediateResult.status = _state;
        var diffTime = nowNs() / 1e6 - _stateChangeMs;

        switch (_intermediateResult.status) {
            case TestState.WAIT:
                _intermediateResult.progress = 0;
                //_intermediateResult.remainingWait = params.getStartTime() - System.currentTimeMillis();
                break;

            case TestState.INIT:
            case TestState.INIT_DOWN:
            case TestState.INIT_UP:
                _intermediateResult.progress = diffTime / _statesInfo.durationInitMs;
                break;

            case TestState.PING:
                _intermediateResult.progress = diffTime / _statesInfo.durationPingMs;
                break;

            case TestState.DOWN:
                _intermediateResult.progress = diffTime / _statesInfo.durationDownMs;
                //downBitPerSec.set(Math.round(getAvgSpeed()));
                break;

            case TestState.UP:
                _intermediateResult.progress = diffTime / _statesInfo.durationUpMs;
                //upBitPerSec.set(Math.round(getAvgSpeed()));
                break;

            case TestState.END:
                _intermediateResult.progress = 1;
                break;

            case TestState.ERROR:
            case TestState.ABORTED:
                _intermediateResult.progress = 0;
                break;
        }
        if (isNaN(_intermediateResult.progress)) {
            _intermediateResult.progress = 0;
        }

        _intermediateResult.progress = Math.min(1, _intermediateResult.progress);

        if (_rmbtTestResult !== null) {
            if (_intermediateResult.status === TestState.PING || _intermediateResult.status === TestState.DOWN) {
                _intermediateResult.pingNano = _rmbtTestResult.ping_server_median;
                _intermediateResult.pings = _rmbtTestResult.pings;
            }

            if (_intermediateResult.status === TestState.DOWN || _intermediateResult.status == TestState.INIT_UP) {
                var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.down;
                });

                _intermediateResult.downBitPerSec = results.speed;
                _intermediateResult.downBitPerSecLog = (Math.log10(_intermediateResult.downBitPerSec / 1e6) + 2) / 4;
            }

            if (_intermediateResult.status === TestState.UP || _intermediateResult.status == TestState.INIT_UP) {
                var _results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.up;
                });

                _intermediateResult.upBitPerSec = _results.speed;
                _intermediateResult.upBitPerSecLog = (Math.log10(_intermediateResult.upBitPerSec / 1e6) + 2) / 4;
            }
        }
        return _intermediateResult;
    };

    /**
     * Conduct the test
     * @param {RMBTControlServerRegistrationResponse} registrationResponse
     * @param {RMBTTestThread} thread info about the thread/local thread data structures
     * @param {Function} callback as soon as all tests are finished
     */
    function conductTest(registrationResponse, thread, callback) {
        var server = (registrationResponse.test_server_encryption ? "wss://" : "ws://") + registrationResponse.test_server_address + ":" + registrationResponse.test_server_port;
        //server = server_override;
        _logger.debug(server);

        var errorFunctions = function () {
            return {
                IGNORE: function IGNORE() {
                    //ignore error :)
                },
                CALLGLOBALHANDLER: function CALLGLOBALHANDLER(e) {
                    if (e) {
                        _logger.error("connection closed", e);
                    }
                    callErrorCallback(RMBTError.CONNECT_FAILED);
                },
                TRYRECONNECT: function TRYRECONNECT() {
                    //@TODO: try to reconnect
                    //@TODO: somehow restart the current phase
                    callErrorCallback(RMBTError.CONNECT_FAILED);
                }
            };
        }();

        //register state enter events
        thread.onStateEnter(TestState.INIT_DOWN, function () {
            setState(TestState.INIT_DOWN);
            _logger.debug(thread.id + ": start short download");
            _chunkSize = MIN_CHUNK_SIZE;

            //all threads download, according to specification
            shortDownloadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.PING, function () {
            setState(TestState.PING);
            _logger.debug(thread.id + ": starting ping");
            //only one thread pings
            if (thread.id === 0) {
                pingTest(thread);
            } else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.DOWN, function () {
            setState(TestState.DOWN);

            //set threads and chunksize
            if (_bytesPerSecsPretest.length > 0) {
                var chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.downloadThreadsLimitsMbit, false);
                _numDownloadThreads = chunkSizes.numThreads;
                if (_changeChunkSizes) {
                    _chunkSize = chunkSizes.chunkSize;
                }
                _bytesPerSecsPretest = [];
            }

            //maybe not all threads have to conduct a download speed test
            if (thread.id < _numDownloadThreads) {
                downloadTest(thread, registrationResponse.test_duration);
            } else {
                thread.socket.onerror = errorFunctions.IGNORE;
                thread.socket.onclose = errorFunctions.IGNORE;
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.CONNECT_UPLOAD, function () {
            setState(TestState.INIT_UP);
            //terminate connection, reconnect
            thread.socket.onerror = errorFunctions.IGNORE;
            thread.socket.onclose = errorFunctions.IGNORE;
            thread.socket.close();
            connectToServer(thread, server, registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
        });

        thread.onStateEnter(TestState.INIT_UP, function () {
            //setState(TestState.INIT_UP);
            _chunkSize = MIN_CHUNK_SIZE;

            shortUploadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.UP, function () {
            setState(TestState.UP);

            //set threads and chunksize
            if (_bytesPerSecsPretest.length > 0) {
                var chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.uploadThreadsLimitsMbit, true);
                _numUploadThreads = chunkSizes.numThreads;
                if (_changeChunkSizes) {
                    _chunkSize = chunkSizes.chunkSize;
                }
                _bytesPerSecsPretest = [];
            }

            //maybe not all threads have to conduct an upload speed test
            if (thread.id < _numUploadThreads) {
                uploadTest(thread, registrationResponse.test_duration);
            } else {
                //the socket is not needed anymore,
                //close it to free up resources
                thread.socket.onerror = errorFunctions.IGNORE;
                thread.socket.onclose = errorFunctions.IGNORE;
                if (thread.socket.readyState !== WebSocket.CLOSED) {
                    thread.socket.close();
                }
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.END, function () {
            //close sockets, if not already closed
            if (thread.socket.readyState !== WebSocket.CLOSED) {
                thread.socket.close();
            }

            if (thread.id === 0) {
                callback();
            }
        });

        //Lifecycle states finished -> INIT, ESTABLISHED, SHORTDOWNLOAD
        //thread.state = TestState.INIT;
        thread.setState(TestState.INIT);
        setState(TestState.INIT);
        connectToServer(thread, server, registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
    }

    /**
     * Connect the given thread to the given websocket server
     * @param {RMBTTestThread} thread
     * @param {String} server server:port
     * @param {String} token
     * @param {Function} errorHandler initial error handler
     */
    function connectToServer(thread, server, token, errorHandler) {
        try {
            thread.socket = new WebSocket(server);
        } catch (e) {
            callErrorCallback(RMBTError.SOCKET_INIT_FAILED);
            return;
        }

        thread.socket.binaryType = "arraybuffer";
        thread.socket.onerror = errorHandler;
        thread.socket.onclose = errorHandler;

        thread.socket.onmessage = function (event) {
            //logger.debug("thread " + thread.id + " triggered, state " + thread.state + " event: " + event);

            //console.log(thread.id + ": Received: " + event.data);
            if (event.data.indexOf("CHUNKSIZE") === 0) {
                var parts = event.data.trim().split(" ");
                //chunksize min and max
                if (parts.length === 4) {
                    DEFAULT_CHUNK_SIZE = parseInt(parts[1]);
                    MIN_CHUNK_SIZE = parseInt(parts[2]);
                    MAX_CHUNK_SIZE = parseInt(parts[3]);
                }
                //min chunksize, max chunksize
                else {
                        DEFAULT_CHUNK_SIZE = parseInt(parts[1]);
                        MIN_CHUNK_SIZE = DEFAULT_CHUNK_SIZE;
                    }
                _logger.debug(thread.id + ": Chunksizes: min " + MIN_CHUNK_SIZE + ", max: " + MAX_CHUNK_SIZE + ", default: " + DEFAULT_CHUNK_SIZE);
            } else if (event.data.indexOf("RMBTv") === 0) {
                //get server version
                var version = event.data.substring(5).trim();
                _rmbtTestConfig.client_version = version;
                if (version.indexOf("1.") === 0) {
                    _changeChunkSizes = true;
                } else if (version.indexOf("0.3") === 0) {
                    _changeChunkSizes = false;
                } else {
                    _logger.warn("unknown server version: " + version);
                }
            } else if (event.data === "ACCEPT TOKEN QUIT\n") {
                thread.socket.send("TOKEN " + token + "\n");
            } else if (event.data === "OK\n" && thread.state === TestState.INIT) {
                _logger.debug(thread.id + ": Token accepted");
            } else if (event.data === "ERR\n") {
                errorHandler();
                _logger.error("got error msg");
            } else if (event.data.indexOf("ACCEPT GETCHUNKS") === 0) {
                thread.triggerNextState();
            }
        };
    }

    /**
     * Calculate chunk size, total pretest bandwidth according
     * to single thread results during upload/download pre-test
     * @param bytesPerSecsPretest array containing single measurement results
     * @param threadLimits limits for determining how many threads to use
     * @param limitToExistingChunks only use chunk sizes that are buffered already (and delete all others)
     * @returns {{numThreads: number, chunkSize: number, bytesPerSecs: number}}
     */
    function calculateChunkSizes(bytesPerSecsPretest, threadLimits, limitToExistingChunks) {
        _totalBytesPerSecsPretest = bytesPerSecsPretest.reduce(function (acc, val) {
            return acc + val;
        });

        _logger.debug("total: circa " + _totalBytesPerSecsPretest / 1000 + " KB/sec");
        _logger.debug("total: circa " + _totalBytesPerSecsPretest * 8 / 1e6 + " MBit/sec");

        //set number of upload threads according to mbit/s measured
        var mbits = _totalBytesPerSecsPretest * 8 / 1e6;
        var threads = 0;
        Object.keys(threadLimits).forEach(function (thresholdMbit) {
            if (mbits > thresholdMbit) {
                threads = threadLimits[thresholdMbit];
            }
        });
        threads = Math.min(_numThreadsAllowed, threads);
        _logger.debug("set number of threads to be used in upcoming speed test to: " + threads);

        //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
        var calculatedChunkSize = _totalBytesPerSecsPretest / (1000 / (_rmbtTestConfig.measurementPointsTimespan / 2));

        //round to the nearest full KB
        calculatedChunkSize -= calculatedChunkSize % 1024;

        //but min 4KiB
        calculatedChunkSize = Math.max(MIN_CHUNK_SIZE, calculatedChunkSize);

        //and max MAX_CHUNKSIZE
        calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);

        _logger.debug("calculated chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");

        if (limitToExistingChunks) {
            //get closest chunk size where there are saved chunks available
            var closest = Number.POSITIVE_INFINITY;
            Object.keys(_arrayBuffers).forEach(function (key) {
                var diff = Math.abs(calculatedChunkSize - key);
                if (diff < Math.abs(calculatedChunkSize - closest)) {
                    // Fix for strange bug, where key sometimes is a string
                    // TODO: investigate source
                    if (typeof key === "string") {
                        key = parseInt(key);
                    }
                    closest = key;
                } else {
                    //if there is already a closer chunk selected, we don't need this
                    //anymore in this test and can dereference it to save heap memory
                    delete _arrayBuffers[key];
                    delete _endArrayBuffers[key];
                }
            });

            calculatedChunkSize = closest;
            _logger.debug("fallback to existing chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");
        }

        return {
            numThreads: threads,
            chunkSize: calculatedChunkSize,
            bytesPerSecs: _totalBytesPerSecsPretest
        };
    }

    /**
     * conduct the short pretest to recognize if the connection
     * is too slow for multiple threads
     * @param {RMBTTestThread} thread
     * @param {Number} durationMs
     */
    function shortDownloadtest(thread, durationMs) {
        var prevListener = thread.socket.onmessage;
        var startTime = nowMs(); //ms since page load
        var n = 1;
        var bytesReceived = 0;
        var chunksize = _chunkSize;

        var loop = function loop() {
            downloadChunks(thread, n, chunksize, function (msg) {
                bytesReceived += n * chunksize;
                _logger.debug(thread.id + ": " + msg);
                var timeNs = parseInt(msg.substring(5));

                var now = nowMs();
                if (now - startTime > durationMs) {
                    //save circa result
                    _bytesPerSecsPretest.push(n * chunksize / (timeNs / 1e9));

                    //"break"
                    thread.socket.onmessage = prevListener;
                } else {
                    if (n < 8 || !_changeChunkSizes) {
                        n = n * 2;
                        loop();
                    } else {
                        chunksize = Math.min(chunksize * 2, MAX_CHUNK_SIZE);
                        loop();
                    }
                }
            });
        };

        loop();
    }

    /**
     * Download n Chunks from the test server
     * @param {RMBTTestThread} thread containing an open socket
     * @param {Number} total how many chunks to download
     * @param {Number} chunkSize size of single chunk in bytes
     * @param {Function} onsuccess expects one argument (String)
     */
    function downloadChunks(thread, total, chunkSize, onsuccess) {
        //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
        var socket = thread.socket;
        var remainingChunks = total;
        var expectBytes = _chunkSize * total;
        var totalRead = 0;
        var lastBuffer = null;

        // https://stackoverflow.com/questions/33702838/how-to-append-bytes-multi-bytes-and-buffer-to-arraybuffer-in-javascript
        var concatBuffer = function concatBuffer(a, b) {
            var c = new Uint8Array(a.length + b.length);
            c.set(a, 0);
            c.set(b, a.length);
            return c;
        };

        var downloadChunkListener = function downloadChunkListener(event) {
            if (typeof event.data === 'string') {
                return;
            }

            var fullChunk = false;

            if (lastBuffer === null) {
                lastBuffer = new Uint8Array(event.data);
            } else {
                lastBuffer = concatBuffer(lastBuffer, new Uint8Array(event.data));
            }

            //console.log("received chunk with " + line.length + " bytes");
            totalRead = totalRead + event.data.byteLength;

            if (lastBuffer.length === chunkSize) {
                remainingChunks--;
                fullChunk = true;
            }

            //zero junks remain - get time
            if (fullChunk && lastBuffer[lastBuffer.length - 1] === 0xFF) {
                //get info
                socket.onmessage = function (line) {
                    var infomsg = line.data;
                    onsuccess(infomsg);
                };

                socket.send("OK\n");
                _endArrayBuffers[chunkSize] = lastBuffer.buffer;
                lastBuffer = null;
            } else {
                if (!_arrayBuffers.hasOwnProperty(chunkSize)) {
                    _arrayBuffers[chunkSize] = [];
                }
                if (fullChunk) {
                    if (_arrayBuffers[chunkSize].length < _rmbtTestConfig.savedChunks) {
                        _arrayBuffers[chunkSize].push(lastBuffer.buffer);
                    }
                    lastBuffer = null;
                }
            }
        };
        socket.onmessage = downloadChunkListener;
        _logger.debug(thread.id + ": downloading " + total + " chunks, " + expectBytes / 1000 + " KB");
        var send = "GETCHUNKS " + total + (chunkSize !== DEFAULT_CHUNK_SIZE ? " " + chunkSize : "") + "\n";
        socket.send(send);
    }

    function pingTest(thread) {
        var prevListener = thread.socket.onmessage;
        var pingsRemaining = _rmbtTestConfig.numPings;
        var startTime = performance.now();

        var onsuccess = function onsuccess(pingResult) {
            thread.result.pings.push(pingResult);
            _rmbtTestResult.pings = [].concat(_toConsumableArray(thread.result.pings));

            //use first two pings to do a better approximation of the remaining time
            if (pingsRemaining === _rmbtTestConfig.numPings - 1) {
                //PING -> PONG -> OK -> TIME -> ACCEPT ... -> PING -> ...
                _statesInfo.durationPingMs = (thread.result.pings[1].timeNs - thread.result.pings[0].timeNs) / 1e6 * _rmbtTestConfig.numPings;
                _logger.debug(thread.id + ": PING phase will take approx " + _statesInfo.durationPingMs + " ms");
            }

            _logger.debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");

            pingsRemaining--;

            //at least one, if we want to repeat ping for a certain interval
            if (_rmbtTestConfig.doPingIntervalMilliseconds > 0 && pingsRemaining === 0) {
                var currentTime = performance.now();
                if (currentTime - startTime < _rmbtTestConfig.doPingIntervalMilliseconds) {
                    pingsRemaining = 1;
                }
            }

            if (pingsRemaining > 0) {
                //wait for new 'ACCEPT'-message
                thread.socket.onmessage = function (event) {
                    if (event.data === "ACCEPT GETCHUNKS GETTIME PUT PUTNORESULT PING QUIT\n") {
                        ping(thread, onsuccess);
                    } else {
                        _logger.error("unexpected error during ping test");
                    }
                };
            } else {
                //"break

                //median ping
                var tArrayClient = [];
                for (var i = 0; i < thread.result.pings.length; i++) {
                    tArrayClient.push(thread.result.pings[i].client);
                }
                _rmbtTestResult.ping_client_median = Math.median(tArrayClient);
                _rmbtTestResult.ping_client_shortest = Math.min.apply(Math, tArrayClient);

                var tArrayServer = [];
                for (var _i = 0; _i < thread.result.pings.length; _i++) {
                    tArrayServer.push(thread.result.pings[_i].server);
                }

                _rmbtTestResult.ping_server_median = Math.median(tArrayServer);
                _rmbtTestResult.ping_server_shortest = Math.min.apply(Math, tArrayServer);

                _logger.debug(thread.id + ": median client: " + Math.round(_rmbtTestResult.ping_client_median / 1e3) / 1e3 + " ms; " + "median server: " + Math.round(_rmbtTestResult.ping_server_median / 1e3) / 1e3 + " ms");
                _logger.debug(thread.id + ": shortest client: " + Math.round(_rmbtTestResult.ping_client_shortest / 1e3) / 1e3 + " ms; " + "shortest server: " + Math.round(_rmbtTestResult.ping_server_shortest / 1e3) / 1e3 + " ms");

                thread.socket.onmessage = prevListener;
            }
        };
        ping(thread, onsuccess);
    }

    /**
     *
     * @param {RMBTTestThread} thread
     * @param {Function} onsuccess upon success
     */
    function ping(thread, onsuccess) {
        var begin = void 0;
        var clientDuration = void 0;
        var pingListener = function pingListener(event) {
            if (event.data === "PONG\n") {
                var end = nowNs();
                clientDuration = end - begin;
                thread.socket.send("OK\n");
            } else if (event.data.indexOf("TIME") === 0) {
                var result = new RMBTPingResult();
                result.client = clientDuration;
                result.server = parseInt(event.data.substring(5));
                result.timeNs = begin;
                onsuccess(result);
            }
        };
        thread.socket.onmessage = pingListener;

        begin = nowNs();
        thread.socket.send("PING\n");
    }

    /**
     *
     * @param {RMBTTestThread} thread
     * @param {Number} duration in seconds
     */
    function downloadTest(thread, duration) {
        var previousListener = thread.socket.onmessage;
        var totalRead = 0;
        var readChunks = 0;
        var lastReportedChunks = -1;

        var interval = void 0;
        var lastRead = void 0;
        var lastChunk = null;
        var lastTime = null;

        //read chunk only at some point in the future to save resources
        interval = window.setInterval(function () {
            if (lastChunk === null) {
                return;
            }

            //nothing new happened, do not simulate an accuracy that does not exist
            if (lastReportedChunks === readChunks) {
                return;
            }
            lastReportedChunks = readChunks;

            var now = nowNs();
            _logger.debug(thread.id + ": " + lastRead + "|" + _rmbtTestConfig.measurementPointsTimespan + "|" + now + "|" + readChunks);

            var lastByte = new Uint8Array(lastChunk, lastChunk.byteLength - 1, 1);

            //add result
            var duration = lastTime - start;
            thread.result.down.push({
                duration: duration,
                bytes: totalRead
            });

            //let now = nowNs();
            lastRead = now;

            if (lastByte[0] >= 0xFF) {
                _logger.debug(thread.id + ": received end chunk");
                window.clearInterval(interval);

                //last chunk received - get time
                thread.socket.onmessage = function (event) {
                    //TIME
                    _logger.debug(event.data);
                    thread.socket.onmessage = previousListener;
                };
                thread.socket.send("OK\n");
            }
        }, _rmbtTestConfig.measurementPointsTimespan);

        var downloadListener = function downloadListener(event) {
            readChunks++;
            totalRead += event.data.byteLength; //arrayBuffer
            lastTime = nowNs();

            lastChunk = event.data;
        };

        thread.socket.onmessage = downloadListener;

        var start = nowNs();
        thread.socket.send("GETTIME " + duration + (_chunkSize !== DEFAULT_CHUNK_SIZE ? " " + _chunkSize : "") + "\n");
    }

    /**
    * conduct the short pretest to recognize if the connection
    * is too slow for multiple threads
    * @param {RMBTTestThread} thread
    * @param {Number} durationMs
    */
    function shortUploadtest(thread, durationMs) {
        var prevListener = thread.socket.onmessage;
        var startTime = nowMs(); //ms since page load
        var n = 1;
        var bytesSent = 0;
        var chunkSize = _chunkSize;

        window.setTimeout(function () {
            var endTime = nowMs();
            var duration = endTime - startTime;
            _logger.debug("diff:" + (duration - durationMs) + " (" + (duration - durationMs) / durationMs + " %)");
        }, durationMs);

        var loop = function loop() {
            uploadChunks(thread, n, chunkSize, function (msg) {
                bytesSent += n * chunkSize;
                _logger.debug(thread.id + ": " + msg);

                var now = nowMs();
                if (now - startTime > durationMs) {
                    //"break"
                    thread.socket.onmessage = prevListener;

                    var timeNs = parseInt(msg.substring(5)); //1e9

                    //save circa result
                    _bytesPerSecsPretest.push(n * chunkSize / (timeNs / 1e9));
                } else {
                    //increase chunk size only if there are saved chunks for it!
                    var newChunkSize = chunkSize * 2;
                    if (n < 8 || !_endArrayBuffers.hasOwnProperty(newChunkSize) || !_changeChunkSizes) {
                        n = n * 2;
                        loop();
                    } else {
                        chunkSize = Math.min(chunkSize * 2, MAX_CHUNK_SIZE);
                        loop();
                    }
                }
            });
        };
        loop();
    }

    /**
     * Upload n Chunks to the test server
     * @param {RMBTTestThread} thread containing an open socket
     * @param {Number} total how many chunks to upload
     * @param {Number} chunkSize size of single chunk in bytes
     * @param {Function} onsuccess expects one argument (String)
     */
    function uploadChunks(thread, total, chunkSize, onsuccess) {
        //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
        var socket = thread.socket;

        socket.onmessage = function (event) {
            if (event.data.indexOf("OK") === 0) {
                //before we start the test
                return;
            } else if (event.data.indexOf("ACCEPT") === 0) {
                //status line after the test - ignore here for now
                return;
            } else {
                onsuccess(event.data); //TIME xxxx
            }
        };

        _logger.debug(thread.id + ": uploading " + total + " chunks, " + chunkSize * total / 1000 + " KB");
        socket.send("PUTNORESULT" + (_changeChunkSizes ? " " + chunkSize : "") + "\n"); //Put no result
        for (var i = 0; i < total; i++) {
            var blob = void 0;
            if (i === total - 1) {
                blob = _endArrayBuffers[chunkSize];
            } else {
                blob = _arrayBuffers[chunkSize][0];
            }
            socket.send(blob);
        }
    }

    /**
     *
     * @param {RMBTTestThread} thread
     * @param {Number} duration in seconds
     */
    function uploadTest(thread, duration) {
        var previousListener = thread.socket.onmessage;

        //if less than approx half a second is left in the buffer - resend!
        var fixedUnderrunBytesVisible = _totalBytesPerSecsPretest / 2 / _numUploadThreads;
        //if less than approx 1.5 seconds is left in the buffer - resend! (since browser limit setTimeout-intervals
        //  when pages are not in the foreground)
        var fixedUnderrunBytesHidden = _totalBytesPerSecsPretest * 1.5 / _numUploadThreads;
        var fixedUnderrunBytes = document.hidden ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;

        var visibilityChangeEventListener = function visibilityChangeEventListener() {
            fixedUnderrunBytes = document.hidden ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;
            _logger.debug("document visibility changed to: " + document.hidden);
        };
        document.addEventListener("visibilitychange", visibilityChangeEventListener);

        //send data for approx one second at once
        //@TODO adapt with changing connection speeds
        var sendAtOnceChunks = Math.ceil(_totalBytesPerSecsPretest / _numUploadThreads / _chunkSize);

        var receivedEndTime = false;
        var keepSendingData = true;

        var lastDurationInfo = -1;
        var timeoutExtensionsMs = 0;

        var timeoutFunction = function timeoutFunction() {
            if (!receivedEndTime) {
                //check how far we are in
                _logger.debug(thread.id + ": is 7.2 sec in, got data for " + lastDurationInfo);
                //if measurements are for < 7sec, give it time
                if (lastDurationInfo < duration * 1e9 && timeoutExtensionsMs < 3000) {
                    window.setTimeout(timeoutFunction, 250);
                    timeoutExtensionsMs += 250;
                } else {
                    //kill it with force!
                    _logger.debug(thread.id + ": didn't finish, timeout extended by " + timeoutExtensionsMs + " ms, last info for " + lastDurationInfo);
                    thread.socket.onerror = function () {};
                    thread.socket.onclose = function () {};

                    //do nothing, we kill it on purpose
                    thread.socket.close();
                    thread.socket.onmessage = previousListener;
                    _logger.debug(thread.id + ": socket now closed: " + thread.socket.readyState);
                    document.removeEventListener("visibilitychange", visibilityChangeEventListener);
                    thread.triggerNextState();
                }
            }
        };

        /**
         * The upload function for a few chunks at a time, encoded as a callback instead of a loop.
         * https://github.com/ndt-project/ndt/blob/master/HTML5-frontend/ndt-browser-client.js
         */
        var sendChunks = function sendChunks() {
            // Monitor the buffersize as it sends and refill if it gets too low.
            if (thread.socket.bufferedAmount < fixedUnderrunBytes) {
                //logger.debug(thread.id + ": buffer underrun");
                for (var i = 0; i < sendAtOnceChunks; i++) {
                    thread.socket.send(_arrayBuffers[_chunkSize][i % _arrayBuffers[_chunkSize].length]);
                }
            } else {
                //logger.debug(thread.id + ": no buffer underrun");
            }

            if (keepSendingData) {
                setTimeout(sendChunks, 0);
            } else {
                return false;
            }
        };

        //set timeout function after 7,2s to check if everything went according to plan
        window.setTimeout(timeoutFunction, duration * 1e3 + 200);

        //send end blob after 7s, quit
        window.setTimeout(function () {
            keepSendingData = false;
            thread.socket.onclose = function () {};
            thread.socket.send(_endArrayBuffers[_chunkSize]);
            thread.socket.send("QUIT\n");
        }, duration * 1e3);

        _logger.debug(thread.id + ": set timeout");

        // ms -> ns
        var timespan = _rmbtTestConfig.measurementPointsTimespan * 1e6;
        var pattern = /TIME (\d+) BYTES (\d+)/;
        var patternEnd = /TIME (\d+)/;
        var uploadListener = function uploadListener(event) {
            //start conducting the test
            if (event.data === "OK\n") {
                sendChunks();
            }

            //intermediate result - save it!
            //TIME 6978414829 BYTES 5738496
            //logger.debug(thread.id + ": rec: " + event.data);
            var matches = pattern.exec(event.data);
            if (matches !== null) {
                var data = {
                    duration: parseInt(matches[1]),
                    bytes: parseInt(matches[2])
                };
                if (data.duration - lastDurationInfo > timespan) {
                    lastDurationInfo = data.duration;
                    //debug(thread.id + ": " + JSON.stringify(data));
                    thread.result.up.push(data);
                }
            } else {
                matches = patternEnd.exec(event.data);
                if (matches !== null) {
                    //statistic for end match - upload phase complete
                    receivedEndTime = true;
                    _logger.debug("Upload duration: " + matches[1]);
                    thread.socket.onmessage = previousListener;
                    document.removeEventListener("visibilitychange", visibilityChangeEventListener);
                }
            }
        };
        thread.socket.onmessage = uploadListener;

        thread.socket.send("PUT" + (_chunkSize !== DEFAULT_CHUNK_SIZE ? " " + _chunkSize : "") + "\n");
    }

    /**
     * Gather test result and prepare data to be sent to server
     *
     * @param {RMBTControlServerRegistrationResponse} registrationResponse
     * @return {Object} Test result to send to server
     */
    function prepareResult(registrationResponse) {
        return {
            client_language: "de",
            client_name: _rmbtTestConfig.client,
            client_uuid: _rmbtTestConfig.uuid,
            client_version: _rmbtTestConfig.client_version,
            client_software_version: _rmbtTestConfig.client_software_version,
            geoLocations: _rmbtTestResult.geoLocations,
            model: _rmbtTestConfig.model,
            network_type: 98,
            platform: _rmbtTestConfig.platform,
            product: _rmbtTestConfig.product,
            pings: _rmbtTestResult.pings,
            test_bytes_download: _rmbtTestResult.bytes_download,
            test_bytes_upload: _rmbtTestResult.bytes_upload,
            test_nsec_download: _rmbtTestResult.nsec_download,
            test_nsec_upload: _rmbtTestResult.nsec_upload,
            test_num_threads: _numDownloadThreads,
            num_threads_ul: _numUploadThreads,
            test_ping_shortest: _rmbtTestResult.ping_server_shortest,
            test_speed_download: _rmbtTestResult.speed_download,
            test_speed_upload: _rmbtTestResult.speed_upload,
            test_token: registrationResponse.test_token,
            test_uuid: registrationResponse.test_uuid,
            time: _rmbtTestResult.beginTime,
            timezone: _rmbtTestConfig.timezone,
            type: "DESKTOP",
            version_code: "1",
            speed_detail: _rmbtTestResult.speedItems,
            user_server_selection: _rmbtTestConfig.userServerSelection
        };
    }

    /**
     * Gets the current state of the test
     * @returns {String} enum [INIT, PING]
     */
    this.getState = function () {
        return "INIT";
    };

    construct(rmbtTestConfig, rmbtControlServer);
};
"use strict";

var curGeoPos = void 0;
var geo_callback = void 0,
    loc_timeout = void 0;

function runCallback() {
    if (geo_callback != undefined && typeof geo_callback === 'function') {
        window.setTimeout(function () {
            geo_callback();
        }, 1);
    }
}

function getCurLocation() {
    return curGeoPos;
}

/**
 * GetLocation, JSDoc from old Test
 * @param {Boolean} geoAccuracy enable high accuracy (i.e. GPS instead of AP)
 * @param {Numeric} geoTimeout maximal timeout before error function is called
 * @param {Numeric} geoMaxAge maximal allowed age in milliseconds
 * @param {Function} callback
 */
function getLocation(geoAccuracy, geoTimeout, geoMaxAge, callback) {
    var ausgabe = document.getElementById("infogeo");
    geo_callback = callback;

    if (!navigator.geolocation) {
        //maybe there is a position in a cookie
        //because the user had been asked for his address
        var coords = getCookie('coords');
        if (coords) {
            var tmpcoords = JSON.parse(coords);
            if (tmpcoords && tmpcoords['lat'] > 0 && tmpcoords['long'] > 0) {
                testVisualization.setLocation(tmpcoords['lat'], tmpcoords['long']);
            }
        } else {
            ausgabe.innerHTML = Lang.getString('NotSupported');
        }

        runCallback();
        return;
    }
    runCallback();
    //var TestEnvironment.getGeoTracker() = new GeoTracker();
    TestEnvironment.getGeoTracker().start(function (successful, error) {
        if (successful !== true) {
            //user did not allow geolocation or other reason
            if (error) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        ausgabe.innerHTML = Lang.getString('NoPermission');
                        break;
                    case error.TIMEOUT:
                        //@TODO: Position is determined...
                        //alert(1);
                        break;
                    case error.POSITION_UNAVAILABLE:
                        ausgabe.innerHTML = Lang.getString('NotAvailable');
                        break;
                    case error.UNKNOWN_ERROR:
                        ausgabe.innerHTML = Lang.getString('NotAvailable') + "(" + error.code + ")";
                        break;
                }
            } else {
                //Internet Explorer 11 in some cases does not return an error code
                ausgabe.innerHTML = Lang.getString('NotAvailable');
            }
        }
    }, TestEnvironment.getTestVisualization());
}

//Geolocation tracking
var GeoTracker = function () {
    "use strict";

    var _errorTimeout = 2e3; //2 seconds error timeout
    var _maxAge = 60e3; //up to one minute old - don't do geoposition again

    var _positions = void 0;
    var _clientCallback = void 0;
    var _testVisualization = null;

    var _watcher = void 0;
    var _firstPositionIsInAccurate = void 0;

    function GeoTracker() {
        _positions = [];
        _firstPositionIsInAccurate = false;
    }

    /**
     * Start geolocating
     * @param {Function(Boolean)} callback expects param 'successful' (boolean, ErrorReason) and
     *      is called as soon as there is a result available or the user cancelled
     * @param {TestVisualization} testVisualization optional
     */
    GeoTracker.prototype.start = function (callback, testVisualization) {
        _clientCallback = callback;

        if (testVisualization !== undefined) {
            _testVisualization = testVisualization;
        }

        if (navigator.geolocation) {
            //try to get an rough first position
            navigator.geolocation.getCurrentPosition(function (success) {
                if (_positions.length === 0) {
                    _firstPositionIsInAccurate = true;
                    successFunction(success);
                }
            }, errorFunction, {
                enableHighAccuracy: false,
                timeout: _errorTimeout, //2 seconds
                maximumAge: _maxAge //one minute
            });
            //and refine this position later
            _watcher = navigator.geolocation.watchPosition(successFunction, errorFunction, {
                enableHighAccuracy: true,
                timeout: Infinity,
                maximumAge: 0 //one minute
            });
        } else {
            var t = _clientCallback;
            _clientCallback = null;
            t(false);
        }

        //Microsoft Edge does not adhere to the standard, and does not call the error
        //function after the specified callback, so we have to call it manually
        window.setTimeout(function () {
            errorFunction();
        }, _errorTimeout);
    };

    /**
     * Saves the given result
     * Is called when a geolocation query returns a result
     * @param {Position} position the result https://developer.mozilla.org/en-US/docs/Web/API/Position
     */
    var successFunction = function successFunction(position) {
        //rough first position and now more accurate one -> remove the inaccurate one
        if (_positions.length === 1 && _firstPositionIsInAccurate) {
            _positions = [];
            _firstPositionIsInAccurate = false;
        }

        _positions.push({
            geo_lat: position.coords.latitude,
            geo_long: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            bearing: position.coords.heading,
            speed: position.coords.speed,
            tstamp: position.timestamp,
            provider: 'Browser'
        });
        if (_clientCallback !== null) {
            //call client that we now have a result
            var t = _clientCallback;
            _clientCallback = null;
            t(true);
        }
        if (_testVisualization !== null) {
            _testVisualization.setLocation(position.coords.latitude, position.coords.longitude);
        }
        updateCookie(position);
    };

    var errorFunction = function errorFunction(reason) {
        //PositionError Object (https://developer.mozilla.org/en-US/docs/Web/API/PositionError)
        if (_clientCallback !== null) {
            //call client that we now have an error
            var t = _clientCallback;
            _clientCallback = null;
            t(false, reason);
        }
    };

    var updateCookie = function updateCookie(position) {
        var coords = {};
        coords['lat'] = position.coords.latitude;
        coords['long'] = position.coords.longitude;
        coords['accuracy'] = position.coords.accuracy;
        coords['altitude'] = position.coords.altitude;
        coords['heading'] = position.coords.heading;
        coords['speed'] = position.coords.speed;
        coords['tstamp'] = position.timestamp;
        //console.log("coords: "+coords);
        coords = JSON.stringify(coords);
        //console.log("tmpcoords: "+tmpcoords);
        setCookie('coords', coords, 3600);
    };

    GeoTracker.prototype.stop = function () {
        if (navigator.geolocation) {
            navigator.geolocation.clearWatch(_watcher);
        }
    };

    /**
     *
     * @returns {Array} all results
     */
    GeoTracker.prototype.getResults = function () {
        //filter duplicate results that can occur when using hardware GPS devices
        //with certain Browsers
        var previousItem = null;
        _positions = _positions.filter(function (position) {
            if (previousItem == null) {
                previousItem = position;
                return true;
            }
            var equal = Object.keys(position).every(function (key) {
                return previousItem.hasOwnProperty(key) && previousItem[key] === position[key];
            });
            if (equal) {
                //remove this item
                return false;
            } else {
                previousItem = position;
                return true;
            }
        });

        return _positions;
    };

    return GeoTracker;
}();

/* getCookie polyfill */
if (typeof window.setCookie === 'undefined') {
    window.setCookie = function (cookie_name, cookie_value, cookie_exseconds) {
        //var exdate = new Date();
        //exdate.setDate(exdate.getDate() + cookie_exdays);

        var futuredate = new Date();
        var expdate = futuredate.getTime();
        expdate += cookie_exseconds * 1000;
        futuredate.setTime(expdate);

        //var c_value=escape(cookie_value) + ((cookie_exdays==null) ? ";" : "; expires="+exdate.toUTCString() +";");
        var c_value = encodeURIComponent(cookie_value) + (cookie_exseconds == null ? ";" : "; expires=" + futuredate.toUTCString() + ";");
        document.cookie = cookie_name + "=" + c_value + " path=/;";
    };
}
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * Handles the communication with the ControlServer
 * @param rmbtTestConfig RMBT Test Configuratio
 * @param options additional options:
 *  'register': Function to be called after registration: function(event)
 *  'submit':  Function to be called after result submission: function(event)
 * @returns Object
 */
var RMBTControlServerCommunication = exports.RMBTControlServerCommunication = function RMBTControlServerCommunication(rmbtTestConfig, options) {
    var _rmbtTestConfig = rmbtTestConfig;
    var _logger = log.getLogger("rmbtws");

    options = options || {};
    var headers = options.headers || {
        'Content-Type': 'application/json'
    };

    return {
        /**
         *
         * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
         */
        obtainControlServerRegistration: function obtainControlServerRegistration(onsuccess, onerror) {
            var json_data = {
                version: _rmbtTestConfig.version,
                language: _rmbtTestConfig.language,
                uuid: _rmbtTestConfig.uuid,
                type: _rmbtTestConfig.type,
                version_code: _rmbtTestConfig.version_code,
                client: _rmbtTestConfig.client,
                timezone: _rmbtTestConfig.timezone,
                time: new Date().getTime()
            };

            //add additional parameters from the configuration, if any
            Object.assign(json_data, _rmbtTestConfig.additionalRegistrationParameters);

            if (typeof userServerSelection !== "undefined" && userServerSelection > 0 && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
                json_data['prefer_server'] = UserConf.preferredServer;
                json_data['user_server_selection'] = userServerSelection;
            }

            var response = void 0;
            fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(json_data)
            }).then(function (res) {
                return res.json();
            }).then(function (data) {
                response = data;
                var config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            }).catch(function (reason) {
                response = reason;
                _logger.error("error getting testID");
                onerror();
            }).finally(function () {
                if (_registrationCallback != null && typeof _registrationCallback === 'function') {
                    _registrationCallback({
                        response: response,
                        request: json_data
                    });
                }
            });
        },

        /**
         * get "data collector" metadata (like browser family) and update config
         *
         */
        getDataCollectorInfo: function getDataCollectorInfo() {
            fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerDataCollectorResource, {
                method: 'GET',
                headers: headers
            }).then(function (res) {
                return res.json();
            }).then(function (data) {
                _rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                _rmbtTestConfig.model = data.product;
                _rmbtTestConfig.os_version = data.version;
            }).catch(function () {
                _logger.error("error getting data collection response");
            });
        },

        /**
         *  Post test result
         *
         * @param {Object}  json_data Data to be sent to server
         * @param {Function} callback
         */
        submitResults: function submitResults(json_data, onsuccess, onerror) {
            //add additional parameters from the configuration, if any
            Object.assign(json_data, _rmbtTestConfig.additionalSubmissionParameters);

            var json = JSON.stringify(json_data);
            _logger.debug("Submit size: " + json.length);

            var response = void 0;
            fetch(_rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource, {
                method: 'POST',
                headers: headers,
                body: json
            }).then(function (res) {
                return res.json();
            }).then(function (data) {
                response = data;
                _logger.debug(json_data.test_uuid);
                onsuccess(true);
            }).catch(function (reason) {
                response = reason;
                _logger.error("error submitting results");
                onerror(false);
            }).finally(function () {
                if (_submissionCallback !== null && typeof _submissionCallback === 'function') {
                    _submissionCallback({
                        response: response,
                        request: json_data
                    });
                }
            });
        }
    };
};
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var TestEnvironment = exports.TestEnvironment = function () {
    var testVisualization = null;
    var geoTracker = null;

    return {
        /**
         * gets the TestVisualization or null
         * @returns {TestVisualization}
         */
        getTestVisualization: function getTestVisualization() {
            return testVisualization;
        },

        /**
         * gets the GeoTracker or null
         * @returns {GeoTracker}
         */
        getGeoTracker: function getGeoTracker() {
            return geoTracker;
        },

        init: function init(tVisualization, gTracker) {
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
}();

//States
var TestState = {
    WAIT: "WAIT",
    INIT: "INIT",
    INIT_DOWN: "INIT_DOWN",
    PING: "PING",
    DOWN: "DOWN",
    CONNECT_UPLOAD: "CONNECT_UPLOAD",
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
function RMBTIntermediateResult() {}
RMBTIntermediateResult.prototype.setLogValues = function () {
    var toLog = function toLog(value) {
        if (value < 10000) {
            return 0;
        }
        return (2.0 + Math.log(value / 1e6 / Math.LN10)) / 4.0;
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

var TestVisualization = function () {

    function TestVisualization(successCallback, errorCallback) {
        this.successCallback = successCallback;
        this.errorCallback = errorCallback;
    }

    /**
     * Sets the RMBT Test object
     * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
     */
    TestVisualization.prototype.setRMBTTest = function (rmbtTest) {};

    /**
     * Will be called from Websockettest as soon as this information is available
     * @param serverName
     * @param remoteIp
     * @param providerName
     * @param testUUID
     */
    TestVisualization.prototype.updateInfo = function (serverName, remoteIp, providerName, testUUID, openTestUUID) {};

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
    TestVisualization.prototype.setLocation = function (latitude, longitude) {};

    /**
     * Starts visualization
     */
    TestVisualization.prototype.startTest = function () {};

    return TestVisualization;
}();
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var RMBTTestConfig = exports.RMBTTestConfig = function () {
    RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.language;
    RMBTTestConfig.prototype.uuid = "";
    RMBTTestConfig.prototype.type = "DESKTOP";
    RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
    RMBTTestConfig.prototype.client_software_version = "0.9.1";
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
    RMBTTestConfig.prototype.userServerSelection = typeof window.userServerSelection !== 'undefined' ? userServerSelection : 0; //for QoSTest
    RMBTTestConfig.prototype.additionalRegistrationParameters = {}; //will be transmitted in ControlServer registration, if any
    RMBTTestConfig.prototype.additionalSubmissionParameters = {}; //will be transmitted in ControlServer result submission, if any

    function RMBTTestConfig(language, controlProxy, wsPath) {
        this.language = language;
        this.controlServerURL = controlProxy + "/" + wsPath;

        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) {
            //we are based in Vienna :-)
            this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replace("Europe/Berlin", "Europe/Vienna");
        }
    }

    return RMBTTestConfig;
}();

var RMBTControlServerRegistrationResponse = function () {
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
}();

/**
 * Control structure for a single websocket-test thread
 * @param {CyclicBarrier} cyclicBarrier
 * @returns {RMBTTestThread}
 */
function RMBTTestThread(cyclicBarrier) {

    var _logger = log.getLogger("rmbtws");
    var _callbacks = {};
    var _cyclicBarrier = cyclicBarrier;

    return {
        /**
         * Sets the state of the thread; triggers state transition callbacks
         * if there are any as soon as all threads in the cyclicbarrier reached
         * the state
         * @param {TestState} state
         */
        setState: function setState(state) {
            this.state = state;
            _logger.debug(this.id + ": reached state: " + state);
            var that = this;
            _cyclicBarrier.await(function () {
                _logger.debug(that.id + ": all threads reached state: " + state);
                if (_callbacks[state] !== undefined && _callbacks[state] !== null) {
                    var callback = _callbacks[state];
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
        onStateEnter: function onStateEnter(state, callback) {
            _callbacks[state] = callback;
        },

        retriggerState: function retriggerState() {
            //trigger state again since we received an 'ERROR'-Message
            setState(this.state);
        },

        /**
         * Triggers the next state in the thread
         */
        triggerNextState: function triggerNextState() {
            var states = [TestState.INIT, TestState.INIT_DOWN, TestState.PING, TestState.DOWN, TestState.CONNECT_UPLOAD, TestState.INIT_UP, TestState.UP, TestState.END];
            if (this.state !== TestState.END) {
                var nextState = states[states.indexOf(this.state) + 1];
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
RMBTTestResult.prototype.addThread = function (rmbtThreadTestResult) {
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
RMBTTestResult.calculateOverallSpeedFromMultipleThreads = function (threads, phaseResults) {
    //TotalTestResult.java:118 (Commit 7d5519ce6ad9121896866d4d8f30299c7c19910d)
    var numThreads = threads.length;
    var targetTime = Infinity;

    for (var i = 0; i < numThreads; i++) {
        var nsecs = phaseResults(threads[i]);
        if (nsecs.length > 0) {
            if (nsecs[nsecs.length - 1].duration < targetTime) {
                targetTime = nsecs[nsecs.length - 1].duration;
            }
        }
    }

    var totalBytes = 0;

    for (var _i = 0; _i < numThreads; _i++) {
        var thread = threads[_i];
        var phasedThread = phaseResults(thread);
        var phasedLength = phasedThread.length;

        if (thread !== null && phasedLength > 0) {
            var targetIdx = phasedLength;
            for (var j = 0; j < phasedLength; j++) {
                if (phasedThread[j].duration >= targetTime) {
                    targetIdx = j;
                    break;
                }
            }
            var calcBytes = void 0;
            if (phasedThread[targetIdx].duration === targetTime) {
                // nsec[max] == targetTime
                calcBytes = phasedThread[phasedLength - 1].bytes;
            } else {
                var bytes1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].bytes;
                var bytes2 = phasedThread[targetIdx].bytes;
                var bytesDiff = bytes2 - bytes1;
                var nsec1 = targetIdx === 0 ? 0 : phasedThread[targetIdx - 1].duration;
                var nsec2 = phasedThread[targetIdx].duration;
                var nsecDiff = nsec2 - nsec1;
                var nsecCompensation = targetTime - nsec1;
                var factor = nsecCompensation / nsecDiff;
                var compensation = Math.round(bytesDiff * factor);

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
        speed: totalBytes * 8 / (targetTime / 1e9)
    };
};

RMBTTestResult.prototype.calculateAll = function () {
    //speed items down
    for (var i = 0; i < this.threads.length; i++) {
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
    var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
        return thread.down;
    });
    this.speed_download = results.speed / 1e3; //bps -> kbps
    this.bytes_download = results.bytes;
    this.nsec_download = results.nsec;

    //speed items up
    for (var _i2 = 0; _i2 < this.threads.length; _i2++) {
        var up = this.threads[_i2].up;
        if (up.length > 0) {
            for (var _j = 0; _j < up.length; _j++) {
                this.speedItems.push({
                    direction: "upload",
                    thread: _i2,
                    time: up[_j].duration,
                    bytes: up[_j].bytes
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
    var pings = this.threads[0].pings;
    for (var _i3 = 0; _i3 < pings.length; _i3++) {
        this.pings.push({
            value: pings[_i3].client,
            value_server: pings[_i3].server,
            time_ns: pings[_i3].timeNs
        });
    }

    //add time_ns to geoLocations
    for (var _i4 = 0; _i4 < this.geoLocations.length; _i4++) {
        var geoLocation = this.geoLocations[_i4];
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
var RMBTError = {
    NOT_SUPPORTED: "WebSockets are not supported",
    SOCKET_INIT_FAILED: "WebSocket initialization failed",
    CONNECT_FAILED: "connection to test server failed",
    SUBMIT_FAILED: "Error during submission of test results",
    REGISTRATION_FAILED: "Error during test registration"
};
"use strict";

//polyfill for microsecond-time
//https://gist.github.com/paulirish/5438650

(function () {
    if (!Date.now) {
        Date.now = function () {
            return new Date().getTime();
        };
    }

    // prepare base perf object
    if (typeof window.performance === 'undefined') {
        window.performance = {};
    }

    if (!window.performance.now || window.performance.now === undefined) {
        var nowOffset = Date.now();

        if (performance.timing && performance.timing.navigationStart) {
            nowOffset = performance.timing.navigationStart;
        }

        window.performance.now = function now() {
            return Date.now() - nowOffset;
        };
    }
})();

function nowMs() {
    return window.performance.now();
}

function nowNs() {
    return Math.round(window.performance.now() * 1e6); //from ms to ns
}

/**
 * Creates a new cyclic barrier
 * @param {number} parties the number of threads that must invoke await()
 *      before the barrier is tripped
 * @see http://docs.oracle.com/javase/7/docs/api/java/util/concurrent/CyclicBarrier.html
 */
function CyclicBarrier(parties) {
    "use strict";

    var _parties = parties;
    var _callbacks = [];

    var release = function release() {
        //first, copy and clear callbacks
        //to prohibit that a callback registers before all others are released
        var tmp = _callbacks.slice();
        _callbacks = [];
        self.setTimeout(function () {
            for (var i = 0; i < _parties; i++) {
                //prevent side effects in last function that called "await"
                tmp[i]();
            }
        }, 1);
    };

    return {
        /**
         * Waits until all parties have invoked await on this barrier
         * The current context is disabled in any case.
         *
         * As soon as all threads have called 'await', all callbacks will
         * be executed
         * @param {Function} callback
         */
        await: function _await(callback) {
            _callbacks.push(callback);
            if (_callbacks.length === _parties) {
                release();
            }
        }

    };
};

/**
 * Finds the median number in the given array
 * http://caseyjustus.com/finding-the-median-of-an-array-with-javascript
 * @param {Array} values
 * @returns {Number} the median
 */
Math.median = function (values) {
    values.sort(function (a, b) {
        return a - b;
    });

    var half = Math.floor(values.length / 2);

    if (values.length % 2) {
        return values[half];
    } else {
        return (values[half - 1] + values[half]) / 2.0;
    }
};

// Polyfill log10 for internet explorer
// https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Math/log10#Polyfill
Math.log10 = Math.log10 || function (x) {
    return Math.log(x) / Math.LN10;
};

//"loglevel" module is used, but if not available, it will fallback to console.log
self.log = self.log || {
    debug: function debug() {
        var _console;

        (_console = console).log.apply(_console, arguments);
    },
    trace: function trace() {
        console.trace();
    },
    info: function info() {
        var _console2;

        (_console2 = console).info.apply(_console2, arguments);
    },
    warn: function warn() {
        var _console3;

        (_console3 = console).warn.apply(_console3, arguments);
    },
    error: function error() {
        var _console4;

        (_console4 = console).error.apply(_console4, arguments);
    },
    setLevel: function setLevel() {},
    getLogger: function getLogger() {
        return log;
    }
};

//Polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function (target, varArgs) {
        // .length of function is 2
        'use strict';

        if (target == null) {
            // TypeError if undefined or null
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource != null) {
                // Skip over if undefined or null
                for (var nextKey in nextSource) {
                    // Avoid bugs when hasOwnProperty is shadowed
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

//"hidden" polyfill (in this case: always visible)
if (typeof document.hidden === "undefined") {
    document.hidden = false;
}
},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L3JtYnR3cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyohKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IDIwMTUtMjAxNyBUaG9tYXMgU2NocmVpYmVyXG4gKiBDb3B5cmlnaHQgMjAxNy0yMDE5IFJ1bmRmdW5rIHVuZCBUZWxla29tIFJlZ3VsaWVydW5ncy1HbWJIIChSVFItR21iSClcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICpcbiAqIFRoZSBzb3VyY2UgY29kZSBmb3IgdGhpcyBwcm9qZWN0IGlzIGF2YWlsYWJsZSBhdFxuICogaHR0cHM6Ly9naXRodWIuY29tL3J0ci1uZXR0ZXN0L3JtYnR3c1xuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqISovXG5cInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBSTUJUVGVzdCBtYWluIG9iamVjdFxuICogQHBhcmFtIHtSTUJUVGVzdENvbmZpZ30gcm1idFRlc3RDb25maWdcbiAqIEBwYXJhbSB7Uk1CVENvbnRyb2xTZXJ2ZXJDb21tdW5pY2F0aW9ufSBybWJ0Q29udHJvbFNlcnZlclxuICogQHJldHVybnMge31cbiAqL1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLlJNQlRUZXN0ID0gUk1CVFRlc3Q7XG5cbmZ1bmN0aW9uIF90b0NvbnN1bWFibGVBcnJheShhcnIpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyBmb3IgKHZhciBpID0gMCwgYXJyMiA9IEFycmF5KGFyci5sZW5ndGgpOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7IGFycjJbaV0gPSBhcnJbaV07IH0gcmV0dXJuIGFycjI7IH0gZWxzZSB7IHJldHVybiBBcnJheS5mcm9tKGFycik7IH0gfVxuXG5mdW5jdGlvbiBSTUJUVGVzdChybWJ0VGVzdENvbmZpZywgcm1idENvbnRyb2xTZXJ2ZXIpIHtcbiAgICB2YXIgX3NlcnZlcl9vdmVycmlkZSA9IFwid3NzOi8vZGV2ZWxvcHY0LXJtYnR3cy5uZXR6dGVzdC5hdDoxOTAwMlwiO1xuXG4gICAgdmFyIF9sb2dnZXIgPSBsb2cuZ2V0TG9nZ2VyKFwicm1idHdzXCIpO1xuXG4gICAgdmFyIF9jaHVua1NpemUgPSBudWxsO1xuICAgIHZhciBNQVhfQ0hVTktfU0laRSA9IDQxOTQzMDQ7XG4gICAgdmFyIE1JTl9DSFVOS19TSVpFID0gMDtcbiAgICB2YXIgREVGQVVMVF9DSFVOS19TSVpFID0gNDA5NjtcbiAgICB2YXIgX2NoYW5nZUNodW5rU2l6ZXMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqICBAdHlwZSB7Uk1CVFRlc3RDb25maWd9XG4gICAgICoqL1xuICAgIHZhciBfcm1idFRlc3RDb25maWcgPSB2b2lkIDA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Uk1CVENvbnRyb2xTZXJ2ZXJDb21tdW5pY2F0aW9ufVxuICAgICAqL1xuICAgIHZhciBfcm1idENvbnRyb2xTZXJ2ZXIgPSB2b2lkIDA7XG4gICAgdmFyIF9ybWJ0VGVzdFJlc3VsdCA9IG51bGw7XG4gICAgdmFyIF9lcnJvckNhbGxiYWNrID0gbnVsbDtcbiAgICB2YXIgX3N0YXRlQ2hhbmdlQ2FsbGJhY2sgPSBudWxsO1xuXG4gICAgdmFyIF9zdGF0ZSA9IFRlc3RTdGF0ZS5JTklUO1xuICAgIHZhciBfc3RhdGVDaGFuZ2VNcyA9IG51bGw7XG4gICAgdmFyIF9zdGF0ZXNJbmZvID0ge1xuICAgICAgICBkdXJhdGlvbkluaXRNczogMjUwMCxcbiAgICAgICAgZHVyYXRpb25QaW5nTXM6IDEwMDAwLCAvL3NldCBkeW5hbWljYWxseVxuICAgICAgICBkdXJhdGlvblVwTXM6IC0xLFxuICAgICAgICBkdXJhdGlvbkRvd25NczogLTFcbiAgICB9O1xuXG4gICAgdmFyIF9pbnRlcm1lZGlhdGVSZXN1bHQgPSBuZXcgUk1CVEludGVybWVkaWF0ZVJlc3VsdCgpO1xuXG4gICAgdmFyIF90aHJlYWRzID0gW107XG4gICAgdmFyIF9hcnJheUJ1ZmZlcnMgPSB7fTtcbiAgICB2YXIgX2VuZEFycmF5QnVmZmVycyA9IHt9O1xuXG4gICAgdmFyIF9jeWNsaWNCYXJyaWVyID0gbnVsbDtcbiAgICB2YXIgX251bVRocmVhZHNBbGxvd2VkID0gMDtcbiAgICB2YXIgX251bURvd25sb2FkVGhyZWFkcyA9IDA7XG4gICAgdmFyIF9udW1VcGxvYWRUaHJlYWRzID0gMDtcblxuICAgIHZhciBfYnl0ZXNQZXJTZWNzUHJldGVzdCA9IFtdO1xuICAgIHZhciBfdG90YWxCeXRlc1BlclNlY3NQcmV0ZXN0ID0gMDtcblxuICAgIC8vdGhpcyBpcyBhbiBvYnNlcnZhYmxlL3N1YmplY3RcbiAgICAvL2h0dHA6Ly9hZGR5b3NtYW5pLmNvbS9yZXNvdXJjZXMvZXNzZW50aWFsanNkZXNpZ25wYXR0ZXJucy9ib29rLyNvYnNlcnZlcnBhdHRlcm5qYXZhc2NyaXB0XG4gICAgLy9STUJUVGVzdC5wcm90b3R5cGUgPSBuZXcgU3ViamVjdCgpO1xuXG5cbiAgICBmdW5jdGlvbiBjb25zdHJ1Y3Qocm1idFRlc3RDb25maWcsIHJtYnRDb250cm9sU2VydmVyKSB7XG4gICAgICAgIC8vaW5pdCBzb2NrZXRcbiAgICAgICAgX3JtYnRUZXN0Q29uZmlnID0gcm1idFRlc3RDb25maWc7IC8vID0gbmV3IFJNQlRUZXN0Q29uZmlnKCk7XG4gICAgICAgIF9ybWJ0Q29udHJvbFNlcnZlciA9IHJtYnRDb250cm9sU2VydmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHN0YXRlIG9mIHRoZSB0ZXN0LCBub3RpZmllcyB0aGUgb2JzZXJ2ZXJzIGlmXG4gICAgICogdGhlIHN0YXRlIGNoYW5nZWRcbiAgICAgKiBAcGFyYW0ge1Rlc3RTdGF0ZX0gc3RhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzZXRTdGF0ZShzdGF0ZSkge1xuICAgICAgICBpZiAoX3N0YXRlID09PSB1bmRlZmluZWQgfHwgX3N0YXRlICE9PSBzdGF0ZSkge1xuICAgICAgICAgICAgX3N0YXRlID0gc3RhdGU7XG4gICAgICAgICAgICBfc3RhdGVDaGFuZ2VNcyA9IG5vd01zKCk7XG4gICAgICAgICAgICBpZiAoX3N0YXRlQ2hhbmdlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBfc3RhdGVDaGFuZ2VDYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGZhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogaW4gY2FzZSB0aGUgd2Vic29ja2V0LXRlc3RcbiAgICAgKiBmYWlscyBmb3IgYW55IHJlYXNvblxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZjdFxuICAgICAqL1xuICAgIHRoaXMub25FcnJvciA9IGZ1bmN0aW9uIChmY3QpIHtcbiAgICAgICAgX2Vycm9yQ2FsbGJhY2sgPSBmY3Q7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIHdoZW4gdGhlIHRlc3QgY2hhbmdlcyBleGVjdXRpb24gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqL1xuICAgIHRoaXMub25TdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBfc3RhdGVDaGFuZ2VDYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDYWxscyB0aGUgZXJyb3IgZnVuY3Rpb24gKGJ1dCBvbmx5IG9uY2UhKVxuICAgICAqIEBwYXJhbSB7Uk1CVEVycm9yfSBlcnJvclxuICAgICAqL1xuICAgIHZhciBjYWxsRXJyb3JDYWxsYmFjayA9IGZ1bmN0aW9uIGNhbGxFcnJvckNhbGxiYWNrKGVycm9yKSB7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoXCJlcnJvciBvY2N1cnJlZCBkdXJpbmcgd2Vic29ja2V0IHRlc3Q6XCIsIGVycm9yKTtcbiAgICAgICAgaWYgKGVycm9yICE9PSBSTUJURXJyb3IuTk9UX1NVUFBPUlRFRCkge1xuICAgICAgICAgICAgc2V0U3RhdGUoVGVzdFN0YXRlLkVSUk9SKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoX2Vycm9yQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhciB0ID0gX2Vycm9yQ2FsbGJhY2s7XG4gICAgICAgICAgICBfZXJyb3JDYWxsYmFjayA9IG51bGw7XG4gICAgICAgICAgICB0KGVycm9yKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLnN0YXJ0VGVzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy9zZWUgaWYgd2Vic29ja2V0cyBhcmUgc3VwcG9ydGVkXG4gICAgICAgIGlmICh3aW5kb3cuV2ViU29ja2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNhbGxFcnJvckNhbGxiYWNrKFJNQlRFcnJvci5OT1RfU1VQUE9SVEVEKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldFN0YXRlKFRlc3RTdGF0ZS5JTklUKTtcbiAgICAgICAgX3JtYnRUZXN0UmVzdWx0ID0gbmV3IFJNQlRUZXN0UmVzdWx0KCk7XG4gICAgICAgIC8vY29ubmVjdCB0byBjb250cm9sIHNlcnZlclxuICAgICAgICBfcm1idENvbnRyb2xTZXJ2ZXIuZ2V0RGF0YUNvbGxlY3RvckluZm8oKTtcblxuICAgICAgICBfcm1idENvbnRyb2xTZXJ2ZXIub2J0YWluQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIF9udW1UaHJlYWRzQWxsb3dlZCA9IHBhcnNlSW50KHJlc3BvbnNlLnRlc3RfbnVtdGhyZWFkcyk7XG4gICAgICAgICAgICBfY3ljbGljQmFycmllciA9IG5ldyBDeWNsaWNCYXJyaWVyKF9udW1UaHJlYWRzQWxsb3dlZCk7XG4gICAgICAgICAgICBfc3RhdGVzSW5mby5kdXJhdGlvbkRvd25NcyA9IHJlc3BvbnNlLnRlc3RfZHVyYXRpb24gKiAxZTM7XG4gICAgICAgICAgICBfc3RhdGVzSW5mby5kdXJhdGlvblVwTXMgPSByZXNwb25zZS50ZXN0X2R1cmF0aW9uICogMWUzO1xuXG4gICAgICAgICAgICAvL0BUT0RPOiBOaWNlclxuICAgICAgICAgICAgLy9pZiB0aGVyZSBpcyB0ZXN0VmlzdWFsaXphdGlvbiwgbWFrZSB1c2Ugb2YgaXQhXG4gICAgICAgICAgICBpZiAoVGVzdEVudmlyb25tZW50LmdldFRlc3RWaXN1YWxpemF0aW9uKCkgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBUZXN0RW52aXJvbm1lbnQuZ2V0VGVzdFZpc3VhbGl6YXRpb24oKS51cGRhdGVJbmZvKHJlc3BvbnNlLnRlc3Rfc2VydmVyX25hbWUsIHJlc3BvbnNlLmNsaWVudF9yZW1vdGVfaXAsIHJlc3BvbnNlLnByb3ZpZGVyLCByZXNwb25zZS50ZXN0X3V1aWQsIHJlc3BvbnNlLm9wZW5fdGVzdF91dWlkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbnRpbnVhdGlvbiA9IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbigpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKFwiZ290IGdlb2xvY2F0aW9uLCBvYnRhaW5pbmcgdG9rZW4gYW5kIHdlYnNvY2tldCBhZGRyZXNzXCIpO1xuXG4gICAgICAgICAgICAgICAgLy93YWl0IGlmIHdlIGhhdmUgdG9cbiAgICAgICAgICAgICAgICB2YXIgY29udGludWF0aW9uID0gZnVuY3Rpb24gY29udGludWF0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRTdGF0ZShUZXN0U3RhdGUuSU5JVCk7XG4gICAgICAgICAgICAgICAgICAgIF9ybWJ0VGVzdFJlc3VsdC5iZWdpblRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgICAgICAvL24gdGhyZWFkc1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IF9udW1UaHJlYWRzQWxsb3dlZDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGhyZWFkID0gbmV3IFJNQlRUZXN0VGhyZWFkKF9jeWNsaWNCYXJyaWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocmVhZC5pZCA9IGk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfcm1idFRlc3RSZXN1bHQuYWRkVGhyZWFkKHRocmVhZC5yZXN1bHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvL29ubHkgb25lIHRocmVhZCB3aWxsIGNhbGwgYWZ0ZXIgdXBsb2FkIGlzIGZpbmlzaGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kdWN0VGVzdChyZXNwb25zZSwgdGhyZWFkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5pbmZvKFwiQWxsIHRlc3RzIGZpbmlzaGVkXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdzR2VvVHJhY2tlci5zdG9wKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3JtYnRUZXN0UmVzdWx0Lmdlb0xvY2F0aW9ucyA9IHdzR2VvVHJhY2tlci5nZXRSZXN1bHRzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3JtYnRUZXN0UmVzdWx0LmNhbGN1bGF0ZUFsbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9ybWJ0Q29udHJvbFNlcnZlci5zdWJtaXRSZXN1bHRzKHByZXBhcmVSZXN1bHQocmVzcG9uc2UpLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFN0YXRlKFRlc3RTdGF0ZS5FTkQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2soUk1CVEVycm9yLlNVQk1JVF9GQUlMRUQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIF90aHJlYWRzLnB1c2godGhyZWFkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2UudGVzdF93YWl0ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbigpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbyhcInRlc3Qgc2NoZWR1bGVkIGZvciBzdGFydCBpbiBcIiArIHJlc3BvbnNlLnRlc3Rfd2FpdCArIFwiIHNlY29uZChzKVwiKTtcbiAgICAgICAgICAgICAgICAgICAgc2V0U3RhdGUoVGVzdFN0YXRlLldBSVQpO1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHJlc3BvbnNlLnRlc3Rfd2FpdCAqIDFlMyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHdzR2VvVHJhY2tlciA9IHZvaWQgMDtcbiAgICAgICAgICAgIC8vZ2V0IHRoZSB1c2VyJ3MgZ2VvbG9jYXRpb25cbiAgICAgICAgICAgIGlmIChUZXN0RW52aXJvbm1lbnQuZ2V0R2VvVHJhY2tlcigpICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgd3NHZW9UcmFja2VyID0gVGVzdEVudmlyb25tZW50LmdldEdlb1RyYWNrZXIoKTtcblxuICAgICAgICAgICAgICAgIC8vaW4gY2FzZSBvZiBsZWdhY3kgY29kZSwgdGhlIGdlb1RyYWNrZXIgd2lsbCBhbHJlYWR5IGJlIHN0YXJ0ZWRcbiAgICAgICAgICAgICAgICBjb250aW51YXRpb24oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd3NHZW9UcmFja2VyID0gbmV3IEdlb1RyYWNrZXIoKTtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKFwiZ2V0dGluZyBnZW9sb2NhdGlvblwiKTtcbiAgICAgICAgICAgICAgICB3c0dlb1RyYWNrZXIuc3RhcnQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51YXRpb24oKTtcbiAgICAgICAgICAgICAgICB9LCBUZXN0RW52aXJvbm1lbnQuZ2V0VGVzdFZpc3VhbGl6YXRpb24oKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vbm8gaW50ZXJuZXQgY29ubmVjdGlvblxuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2soUk1CVEVycm9yLlJFR0lTVFJBVElPTl9GQUlMRUQpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Uk1CVEludGVybWVkaWF0ZVJlc3VsdH1cbiAgICAgKi9cbiAgICB0aGlzLmdldEludGVybWVkaWF0ZVJlc3VsdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX2ludGVybWVkaWF0ZVJlc3VsdC5zdGF0dXMgPSBfc3RhdGU7XG4gICAgICAgIHZhciBkaWZmVGltZSA9IG5vd05zKCkgLyAxZTYgLSBfc3RhdGVDaGFuZ2VNcztcblxuICAgICAgICBzd2l0Y2ggKF9pbnRlcm1lZGlhdGVSZXN1bHQuc3RhdHVzKSB7XG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5XQUlUOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSAwO1xuICAgICAgICAgICAgICAgIC8vX2ludGVybWVkaWF0ZVJlc3VsdC5yZW1haW5pbmdXYWl0ID0gcGFyYW1zLmdldFN0YXJ0VGltZSgpIC0gU3lzdGVtLmN1cnJlbnRUaW1lTWlsbGlzKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgVGVzdFN0YXRlLklOSVQ6XG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5JTklUX0RPV046XG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5JTklUX1VQOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSBkaWZmVGltZSAvIF9zdGF0ZXNJbmZvLmR1cmF0aW9uSW5pdE1zO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5QSU5HOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSBkaWZmVGltZSAvIF9zdGF0ZXNJbmZvLmR1cmF0aW9uUGluZ01zO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5ET1dOOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSBkaWZmVGltZSAvIF9zdGF0ZXNJbmZvLmR1cmF0aW9uRG93bk1zO1xuICAgICAgICAgICAgICAgIC8vZG93bkJpdFBlclNlYy5zZXQoTWF0aC5yb3VuZChnZXRBdmdTcGVlZCgpKSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgVGVzdFN0YXRlLlVQOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSBkaWZmVGltZSAvIF9zdGF0ZXNJbmZvLmR1cmF0aW9uVXBNcztcbiAgICAgICAgICAgICAgICAvL3VwQml0UGVyU2VjLnNldChNYXRoLnJvdW5kKGdldEF2Z1NwZWVkKCkpKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBUZXN0U3RhdGUuRU5EOlxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSAxO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFRlc3RTdGF0ZS5FUlJPUjpcbiAgICAgICAgICAgIGNhc2UgVGVzdFN0YXRlLkFCT1JURUQ6XG4gICAgICAgICAgICAgICAgX2ludGVybWVkaWF0ZVJlc3VsdC5wcm9ncmVzcyA9IDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzTmFOKF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICBfaW50ZXJtZWRpYXRlUmVzdWx0LnByb2dyZXNzID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucHJvZ3Jlc3MgPSBNYXRoLm1pbigxLCBfaW50ZXJtZWRpYXRlUmVzdWx0LnByb2dyZXNzKTtcblxuICAgICAgICBpZiAoX3JtYnRUZXN0UmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoX2ludGVybWVkaWF0ZVJlc3VsdC5zdGF0dXMgPT09IFRlc3RTdGF0ZS5QSU5HIHx8IF9pbnRlcm1lZGlhdGVSZXN1bHQuc3RhdHVzID09PSBUZXN0U3RhdGUuRE9XTikge1xuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucGluZ05hbm8gPSBfcm1idFRlc3RSZXN1bHQucGluZ19zZXJ2ZXJfbWVkaWFuO1xuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQucGluZ3MgPSBfcm1idFRlc3RSZXN1bHQucGluZ3M7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChfaW50ZXJtZWRpYXRlUmVzdWx0LnN0YXR1cyA9PT0gVGVzdFN0YXRlLkRPV04gfHwgX2ludGVybWVkaWF0ZVJlc3VsdC5zdGF0dXMgPT0gVGVzdFN0YXRlLklOSVRfVVApIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0cyA9IFJNQlRUZXN0UmVzdWx0LmNhbGN1bGF0ZU92ZXJhbGxTcGVlZEZyb21NdWx0aXBsZVRocmVhZHMoX3JtYnRUZXN0UmVzdWx0LnRocmVhZHMsIGZ1bmN0aW9uICh0aHJlYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRocmVhZC5kb3duO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgX2ludGVybWVkaWF0ZVJlc3VsdC5kb3duQml0UGVyU2VjID0gcmVzdWx0cy5zcGVlZDtcbiAgICAgICAgICAgICAgICBfaW50ZXJtZWRpYXRlUmVzdWx0LmRvd25CaXRQZXJTZWNMb2cgPSAoTWF0aC5sb2cxMChfaW50ZXJtZWRpYXRlUmVzdWx0LmRvd25CaXRQZXJTZWMgLyAxZTYpICsgMikgLyA0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoX2ludGVybWVkaWF0ZVJlc3VsdC5zdGF0dXMgPT09IFRlc3RTdGF0ZS5VUCB8fCBfaW50ZXJtZWRpYXRlUmVzdWx0LnN0YXR1cyA9PSBUZXN0U3RhdGUuSU5JVF9VUCkge1xuICAgICAgICAgICAgICAgIHZhciBfcmVzdWx0cyA9IFJNQlRUZXN0UmVzdWx0LmNhbGN1bGF0ZU92ZXJhbGxTcGVlZEZyb21NdWx0aXBsZVRocmVhZHMoX3JtYnRUZXN0UmVzdWx0LnRocmVhZHMsIGZ1bmN0aW9uICh0aHJlYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRocmVhZC51cDtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIF9pbnRlcm1lZGlhdGVSZXN1bHQudXBCaXRQZXJTZWMgPSBfcmVzdWx0cy5zcGVlZDtcbiAgICAgICAgICAgICAgICBfaW50ZXJtZWRpYXRlUmVzdWx0LnVwQml0UGVyU2VjTG9nID0gKE1hdGgubG9nMTAoX2ludGVybWVkaWF0ZVJlc3VsdC51cEJpdFBlclNlYyAvIDFlNikgKyAyKSAvIDQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9pbnRlcm1lZGlhdGVSZXN1bHQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENvbmR1Y3QgdGhlIHRlc3RcbiAgICAgKiBAcGFyYW0ge1JNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2V9IHJlZ2lzdHJhdGlvblJlc3BvbnNlXG4gICAgICogQHBhcmFtIHtSTUJUVGVzdFRocmVhZH0gdGhyZWFkIGluZm8gYWJvdXQgdGhlIHRocmVhZC9sb2NhbCB0aHJlYWQgZGF0YSBzdHJ1Y3R1cmVzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgYXMgc29vbiBhcyBhbGwgdGVzdHMgYXJlIGZpbmlzaGVkXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29uZHVjdFRlc3QocmVnaXN0cmF0aW9uUmVzcG9uc2UsIHRocmVhZCwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlcnZlciA9IChyZWdpc3RyYXRpb25SZXNwb25zZS50ZXN0X3NlcnZlcl9lbmNyeXB0aW9uID8gXCJ3c3M6Ly9cIiA6IFwid3M6Ly9cIikgKyByZWdpc3RyYXRpb25SZXNwb25zZS50ZXN0X3NlcnZlcl9hZGRyZXNzICsgXCI6XCIgKyByZWdpc3RyYXRpb25SZXNwb25zZS50ZXN0X3NlcnZlcl9wb3J0O1xuICAgICAgICAvL3NlcnZlciA9IHNlcnZlcl9vdmVycmlkZTtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZyhzZXJ2ZXIpO1xuXG4gICAgICAgIHZhciBlcnJvckZ1bmN0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgSUdOT1JFOiBmdW5jdGlvbiBJR05PUkUoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vaWdub3JlIGVycm9yIDopXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBDQUxMR0xPQkFMSEFORExFUjogZnVuY3Rpb24gQ0FMTEdMT0JBTEhBTkRMRVIoZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5lcnJvcihcImNvbm5lY3Rpb24gY2xvc2VkXCIsIGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxFcnJvckNhbGxiYWNrKFJNQlRFcnJvci5DT05ORUNUX0ZBSUxFRCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBUUllSRUNPTk5FQ1Q6IGZ1bmN0aW9uIFRSWVJFQ09OTkVDVCgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9AVE9ETzogdHJ5IHRvIHJlY29ubmVjdFxuICAgICAgICAgICAgICAgICAgICAvL0BUT0RPOiBzb21laG93IHJlc3RhcnQgdGhlIGN1cnJlbnQgcGhhc2VcbiAgICAgICAgICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2soUk1CVEVycm9yLkNPTk5FQ1RfRkFJTEVEKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9KCk7XG5cbiAgICAgICAgLy9yZWdpc3RlciBzdGF0ZSBlbnRlciBldmVudHNcbiAgICAgICAgdGhyZWFkLm9uU3RhdGVFbnRlcihUZXN0U3RhdGUuSU5JVF9ET1dOLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZXRTdGF0ZShUZXN0U3RhdGUuSU5JVF9ET1dOKTtcbiAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IHN0YXJ0IHNob3J0IGRvd25sb2FkXCIpO1xuICAgICAgICAgICAgX2NodW5rU2l6ZSA9IE1JTl9DSFVOS19TSVpFO1xuXG4gICAgICAgICAgICAvL2FsbCB0aHJlYWRzIGRvd25sb2FkLCBhY2NvcmRpbmcgdG8gc3BlY2lmaWNhdGlvblxuICAgICAgICAgICAgc2hvcnREb3dubG9hZHRlc3QodGhyZWFkLCBfcm1idFRlc3RDb25maWcucHJldGVzdER1cmF0aW9uTXMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aHJlYWQub25TdGF0ZUVudGVyKFRlc3RTdGF0ZS5QSU5HLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZXRTdGF0ZShUZXN0U3RhdGUuUElORyk7XG4gICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBzdGFydGluZyBwaW5nXCIpO1xuICAgICAgICAgICAgLy9vbmx5IG9uZSB0aHJlYWQgcGluZ3NcbiAgICAgICAgICAgIGlmICh0aHJlYWQuaWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBwaW5nVGVzdCh0aHJlYWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJlYWQudHJpZ2dlck5leHRTdGF0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aHJlYWQub25TdGF0ZUVudGVyKFRlc3RTdGF0ZS5ET1dOLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZXRTdGF0ZShUZXN0U3RhdGUuRE9XTik7XG5cbiAgICAgICAgICAgIC8vc2V0IHRocmVhZHMgYW5kIGNodW5rc2l6ZVxuICAgICAgICAgICAgaWYgKF9ieXRlc1BlclNlY3NQcmV0ZXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgY2h1bmtTaXplcyA9IGNhbGN1bGF0ZUNodW5rU2l6ZXMoX2J5dGVzUGVyU2Vjc1ByZXRlc3QsIF9ybWJ0VGVzdENvbmZpZy5kb3dubG9hZFRocmVhZHNMaW1pdHNNYml0LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgX251bURvd25sb2FkVGhyZWFkcyA9IGNodW5rU2l6ZXMubnVtVGhyZWFkcztcbiAgICAgICAgICAgICAgICBpZiAoX2NoYW5nZUNodW5rU2l6ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgX2NodW5rU2l6ZSA9IGNodW5rU2l6ZXMuY2h1bmtTaXplO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfYnl0ZXNQZXJTZWNzUHJldGVzdCA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL21heWJlIG5vdCBhbGwgdGhyZWFkcyBoYXZlIHRvIGNvbmR1Y3QgYSBkb3dubG9hZCBzcGVlZCB0ZXN0XG4gICAgICAgICAgICBpZiAodGhyZWFkLmlkIDwgX251bURvd25sb2FkVGhyZWFkcykge1xuICAgICAgICAgICAgICAgIGRvd25sb2FkVGVzdCh0aHJlYWQsIHJlZ2lzdHJhdGlvblJlc3BvbnNlLnRlc3RfZHVyYXRpb24pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0Lm9uZXJyb3IgPSBlcnJvckZ1bmN0aW9ucy5JR05PUkU7XG4gICAgICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5vbmNsb3NlID0gZXJyb3JGdW5jdGlvbnMuSUdOT1JFO1xuICAgICAgICAgICAgICAgIHRocmVhZC50cmlnZ2VyTmV4dFN0YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRocmVhZC5vblN0YXRlRW50ZXIoVGVzdFN0YXRlLkNPTk5FQ1RfVVBMT0FELCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZXRTdGF0ZShUZXN0U3RhdGUuSU5JVF9VUCk7XG4gICAgICAgICAgICAvL3Rlcm1pbmF0ZSBjb25uZWN0aW9uLCByZWNvbm5lY3RcbiAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25lcnJvciA9IGVycm9yRnVuY3Rpb25zLklHTk9SRTtcbiAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25jbG9zZSA9IGVycm9yRnVuY3Rpb25zLklHTk9SRTtcbiAgICAgICAgICAgIHRocmVhZC5zb2NrZXQuY2xvc2UoKTtcbiAgICAgICAgICAgIGNvbm5lY3RUb1NlcnZlcih0aHJlYWQsIHNlcnZlciwgcmVnaXN0cmF0aW9uUmVzcG9uc2UudGVzdF90b2tlbiwgZXJyb3JGdW5jdGlvbnMuQ0FMTEdMT0JBTEhBTkRMRVIpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aHJlYWQub25TdGF0ZUVudGVyKFRlc3RTdGF0ZS5JTklUX1VQLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvL3NldFN0YXRlKFRlc3RTdGF0ZS5JTklUX1VQKTtcbiAgICAgICAgICAgIF9jaHVua1NpemUgPSBNSU5fQ0hVTktfU0laRTtcblxuICAgICAgICAgICAgc2hvcnRVcGxvYWR0ZXN0KHRocmVhZCwgX3JtYnRUZXN0Q29uZmlnLnByZXRlc3REdXJhdGlvbk1zKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhyZWFkLm9uU3RhdGVFbnRlcihUZXN0U3RhdGUuVVAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldFN0YXRlKFRlc3RTdGF0ZS5VUCk7XG5cbiAgICAgICAgICAgIC8vc2V0IHRocmVhZHMgYW5kIGNodW5rc2l6ZVxuICAgICAgICAgICAgaWYgKF9ieXRlc1BlclNlY3NQcmV0ZXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgY2h1bmtTaXplcyA9IGNhbGN1bGF0ZUNodW5rU2l6ZXMoX2J5dGVzUGVyU2Vjc1ByZXRlc3QsIF9ybWJ0VGVzdENvbmZpZy51cGxvYWRUaHJlYWRzTGltaXRzTWJpdCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgX251bVVwbG9hZFRocmVhZHMgPSBjaHVua1NpemVzLm51bVRocmVhZHM7XG4gICAgICAgICAgICAgICAgaWYgKF9jaGFuZ2VDaHVua1NpemVzKSB7XG4gICAgICAgICAgICAgICAgICAgIF9jaHVua1NpemUgPSBjaHVua1NpemVzLmNodW5rU2l6ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2J5dGVzUGVyU2Vjc1ByZXRlc3QgPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9tYXliZSBub3QgYWxsIHRocmVhZHMgaGF2ZSB0byBjb25kdWN0IGFuIHVwbG9hZCBzcGVlZCB0ZXN0XG4gICAgICAgICAgICBpZiAodGhyZWFkLmlkIDwgX251bVVwbG9hZFRocmVhZHMpIHtcbiAgICAgICAgICAgICAgICB1cGxvYWRUZXN0KHRocmVhZCwgcmVnaXN0cmF0aW9uUmVzcG9uc2UudGVzdF9kdXJhdGlvbik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vdGhlIHNvY2tldCBpcyBub3QgbmVlZGVkIGFueW1vcmUsXG4gICAgICAgICAgICAgICAgLy9jbG9zZSBpdCB0byBmcmVlIHVwIHJlc291cmNlc1xuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25lcnJvciA9IGVycm9yRnVuY3Rpb25zLklHTk9SRTtcbiAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0Lm9uY2xvc2UgPSBlcnJvckZ1bmN0aW9ucy5JR05PUkU7XG4gICAgICAgICAgICAgICAgaWYgKHRocmVhZC5zb2NrZXQucmVhZHlTdGF0ZSAhPT0gV2ViU29ja2V0LkNMT1NFRCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocmVhZC50cmlnZ2VyTmV4dFN0YXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRocmVhZC5vblN0YXRlRW50ZXIoVGVzdFN0YXRlLkVORCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy9jbG9zZSBzb2NrZXRzLCBpZiBub3QgYWxyZWFkeSBjbG9zZWRcbiAgICAgICAgICAgIGlmICh0aHJlYWQuc29ja2V0LnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5DTE9TRUQpIHtcbiAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0LmNsb3NlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aHJlYWQuaWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvL0xpZmVjeWNsZSBzdGF0ZXMgZmluaXNoZWQgLT4gSU5JVCwgRVNUQUJMSVNIRUQsIFNIT1JURE9XTkxPQURcbiAgICAgICAgLy90aHJlYWQuc3RhdGUgPSBUZXN0U3RhdGUuSU5JVDtcbiAgICAgICAgdGhyZWFkLnNldFN0YXRlKFRlc3RTdGF0ZS5JTklUKTtcbiAgICAgICAgc2V0U3RhdGUoVGVzdFN0YXRlLklOSVQpO1xuICAgICAgICBjb25uZWN0VG9TZXJ2ZXIodGhyZWFkLCBzZXJ2ZXIsIHJlZ2lzdHJhdGlvblJlc3BvbnNlLnRlc3RfdG9rZW4sIGVycm9yRnVuY3Rpb25zLkNBTExHTE9CQUxIQU5ETEVSKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0IHRoZSBnaXZlbiB0aHJlYWQgdG8gdGhlIGdpdmVuIHdlYnNvY2tldCBzZXJ2ZXJcbiAgICAgKiBAcGFyYW0ge1JNQlRUZXN0VGhyZWFkfSB0aHJlYWRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc2VydmVyIHNlcnZlcjpwb3J0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRva2VuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXJyb3JIYW5kbGVyIGluaXRpYWwgZXJyb3IgaGFuZGxlclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNvbm5lY3RUb1NlcnZlcih0aHJlYWQsIHNlcnZlciwgdG9rZW4sIGVycm9ySGFuZGxlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhyZWFkLnNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc2VydmVyKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY2FsbEVycm9yQ2FsbGJhY2soUk1CVEVycm9yLlNPQ0tFVF9JTklUX0ZBSUxFRCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aHJlYWQuc29ja2V0LmJpbmFyeVR5cGUgPSBcImFycmF5YnVmZmVyXCI7XG4gICAgICAgIHRocmVhZC5zb2NrZXQub25lcnJvciA9IGVycm9ySGFuZGxlcjtcbiAgICAgICAgdGhyZWFkLnNvY2tldC5vbmNsb3NlID0gZXJyb3JIYW5kbGVyO1xuXG4gICAgICAgIHRocmVhZC5zb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5kZWJ1ZyhcInRocmVhZCBcIiArIHRocmVhZC5pZCArIFwiIHRyaWdnZXJlZCwgc3RhdGUgXCIgKyB0aHJlYWQuc3RhdGUgKyBcIiBldmVudDogXCIgKyBldmVudCk7XG5cbiAgICAgICAgICAgIC8vY29uc29sZS5sb2codGhyZWFkLmlkICsgXCI6IFJlY2VpdmVkOiBcIiArIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGV2ZW50LmRhdGEuaW5kZXhPZihcIkNIVU5LU0laRVwiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IGV2ZW50LmRhdGEudHJpbSgpLnNwbGl0KFwiIFwiKTtcbiAgICAgICAgICAgICAgICAvL2NodW5rc2l6ZSBtaW4gYW5kIG1heFxuICAgICAgICAgICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgREVGQVVMVF9DSFVOS19TSVpFID0gcGFyc2VJbnQocGFydHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICBNSU5fQ0hVTktfU0laRSA9IHBhcnNlSW50KHBhcnRzWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgTUFYX0NIVU5LX1NJWkUgPSBwYXJzZUludChwYXJ0c1szXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vbWluIGNodW5rc2l6ZSwgbWF4IGNodW5rc2l6ZVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgREVGQVVMVF9DSFVOS19TSVpFID0gcGFyc2VJbnQocGFydHNbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgTUlOX0NIVU5LX1NJWkUgPSBERUZBVUxUX0NIVU5LX1NJWkU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBDaHVua3NpemVzOiBtaW4gXCIgKyBNSU5fQ0hVTktfU0laRSArIFwiLCBtYXg6IFwiICsgTUFYX0NIVU5LX1NJWkUgKyBcIiwgZGVmYXVsdDogXCIgKyBERUZBVUxUX0NIVU5LX1NJWkUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmluZGV4T2YoXCJSTUJUdlwiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIC8vZ2V0IHNlcnZlciB2ZXJzaW9uXG4gICAgICAgICAgICAgICAgdmFyIHZlcnNpb24gPSBldmVudC5kYXRhLnN1YnN0cmluZyg1KS50cmltKCk7XG4gICAgICAgICAgICAgICAgX3JtYnRUZXN0Q29uZmlnLmNsaWVudF92ZXJzaW9uID0gdmVyc2lvbjtcbiAgICAgICAgICAgICAgICBpZiAodmVyc2lvbi5pbmRleE9mKFwiMS5cIikgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgX2NoYW5nZUNodW5rU2l6ZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmVyc2lvbi5pbmRleE9mKFwiMC4zXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIF9jaGFuZ2VDaHVua1NpemVzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci53YXJuKFwidW5rbm93biBzZXJ2ZXIgdmVyc2lvbjogXCIgKyB2ZXJzaW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRhdGEgPT09IFwiQUNDRVBUIFRPS0VOIFFVSVRcXG5cIikge1xuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQuc2VuZChcIlRPS0VOIFwiICsgdG9rZW4gKyBcIlxcblwiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuZGF0YSA9PT0gXCJPS1xcblwiICYmIHRocmVhZC5zdGF0ZSA9PT0gVGVzdFN0YXRlLklOSVQpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBUb2tlbiBhY2NlcHRlZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuZGF0YSA9PT0gXCJFUlJcXG5cIikge1xuICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlcigpO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZXJyb3IoXCJnb3QgZXJyb3IgbXNnXCIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmluZGV4T2YoXCJBQ0NFUFQgR0VUQ0hVTktTXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyZWFkLnRyaWdnZXJOZXh0U3RhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgY2h1bmsgc2l6ZSwgdG90YWwgcHJldGVzdCBiYW5kd2lkdGggYWNjb3JkaW5nXG4gICAgICogdG8gc2luZ2xlIHRocmVhZCByZXN1bHRzIGR1cmluZyB1cGxvYWQvZG93bmxvYWQgcHJlLXRlc3RcbiAgICAgKiBAcGFyYW0gYnl0ZXNQZXJTZWNzUHJldGVzdCBhcnJheSBjb250YWluaW5nIHNpbmdsZSBtZWFzdXJlbWVudCByZXN1bHRzXG4gICAgICogQHBhcmFtIHRocmVhZExpbWl0cyBsaW1pdHMgZm9yIGRldGVybWluaW5nIGhvdyBtYW55IHRocmVhZHMgdG8gdXNlXG4gICAgICogQHBhcmFtIGxpbWl0VG9FeGlzdGluZ0NodW5rcyBvbmx5IHVzZSBjaHVuayBzaXplcyB0aGF0IGFyZSBidWZmZXJlZCBhbHJlYWR5IChhbmQgZGVsZXRlIGFsbCBvdGhlcnMpXG4gICAgICogQHJldHVybnMge3tudW1UaHJlYWRzOiBudW1iZXIsIGNodW5rU2l6ZTogbnVtYmVyLCBieXRlc1BlclNlY3M6IG51bWJlcn19XG4gICAgICovXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlQ2h1bmtTaXplcyhieXRlc1BlclNlY3NQcmV0ZXN0LCB0aHJlYWRMaW1pdHMsIGxpbWl0VG9FeGlzdGluZ0NodW5rcykge1xuICAgICAgICBfdG90YWxCeXRlc1BlclNlY3NQcmV0ZXN0ID0gYnl0ZXNQZXJTZWNzUHJldGVzdC5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgdmFsKSB7XG4gICAgICAgICAgICByZXR1cm4gYWNjICsgdmFsO1xuICAgICAgICB9KTtcblxuICAgICAgICBfbG9nZ2VyLmRlYnVnKFwidG90YWw6IGNpcmNhIFwiICsgX3RvdGFsQnl0ZXNQZXJTZWNzUHJldGVzdCAvIDEwMDAgKyBcIiBLQi9zZWNcIik7XG4gICAgICAgIF9sb2dnZXIuZGVidWcoXCJ0b3RhbDogY2lyY2EgXCIgKyBfdG90YWxCeXRlc1BlclNlY3NQcmV0ZXN0ICogOCAvIDFlNiArIFwiIE1CaXQvc2VjXCIpO1xuXG4gICAgICAgIC8vc2V0IG51bWJlciBvZiB1cGxvYWQgdGhyZWFkcyBhY2NvcmRpbmcgdG8gbWJpdC9zIG1lYXN1cmVkXG4gICAgICAgIHZhciBtYml0cyA9IF90b3RhbEJ5dGVzUGVyU2Vjc1ByZXRlc3QgKiA4IC8gMWU2O1xuICAgICAgICB2YXIgdGhyZWFkcyA9IDA7XG4gICAgICAgIE9iamVjdC5rZXlzKHRocmVhZExpbWl0cykuZm9yRWFjaChmdW5jdGlvbiAodGhyZXNob2xkTWJpdCkge1xuICAgICAgICAgICAgaWYgKG1iaXRzID4gdGhyZXNob2xkTWJpdCkge1xuICAgICAgICAgICAgICAgIHRocmVhZHMgPSB0aHJlYWRMaW1pdHNbdGhyZXNob2xkTWJpdF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aHJlYWRzID0gTWF0aC5taW4oX251bVRocmVhZHNBbGxvd2VkLCB0aHJlYWRzKTtcbiAgICAgICAgX2xvZ2dlci5kZWJ1ZyhcInNldCBudW1iZXIgb2YgdGhyZWFkcyB0byBiZSB1c2VkIGluIHVwY29taW5nIHNwZWVkIHRlc3QgdG86IFwiICsgdGhyZWFkcyk7XG5cbiAgICAgICAgLy9zZXQgY2h1bmsgc2l6ZSB0byBhY2NvcmRpbmdseSAxIGNodW5rIGV2ZXJ5IG4vMiBtcyBvbiBhdmVyYWdlIHdpdGggbiB0aHJlYWRzXG4gICAgICAgIHZhciBjYWxjdWxhdGVkQ2h1bmtTaXplID0gX3RvdGFsQnl0ZXNQZXJTZWNzUHJldGVzdCAvICgxMDAwIC8gKF9ybWJ0VGVzdENvbmZpZy5tZWFzdXJlbWVudFBvaW50c1RpbWVzcGFuIC8gMikpO1xuXG4gICAgICAgIC8vcm91bmQgdG8gdGhlIG5lYXJlc3QgZnVsbCBLQlxuICAgICAgICBjYWxjdWxhdGVkQ2h1bmtTaXplIC09IGNhbGN1bGF0ZWRDaHVua1NpemUgJSAxMDI0O1xuXG4gICAgICAgIC8vYnV0IG1pbiA0S2lCXG4gICAgICAgIGNhbGN1bGF0ZWRDaHVua1NpemUgPSBNYXRoLm1heChNSU5fQ0hVTktfU0laRSwgY2FsY3VsYXRlZENodW5rU2l6ZSk7XG5cbiAgICAgICAgLy9hbmQgbWF4IE1BWF9DSFVOS1NJWkVcbiAgICAgICAgY2FsY3VsYXRlZENodW5rU2l6ZSA9IE1hdGgubWluKE1BWF9DSFVOS19TSVpFLCBjYWxjdWxhdGVkQ2h1bmtTaXplKTtcblxuICAgICAgICBfbG9nZ2VyLmRlYnVnKFwiY2FsY3VsYXRlZCBjaHVua3NpemUgZm9yIHVwY29taW5nIHNwZWVkIHRlc3QgXCIgKyBjYWxjdWxhdGVkQ2h1bmtTaXplIC8gMTAyNCArIFwiIEtCXCIpO1xuXG4gICAgICAgIGlmIChsaW1pdFRvRXhpc3RpbmdDaHVua3MpIHtcbiAgICAgICAgICAgIC8vZ2V0IGNsb3Nlc3QgY2h1bmsgc2l6ZSB3aGVyZSB0aGVyZSBhcmUgc2F2ZWQgY2h1bmtzIGF2YWlsYWJsZVxuICAgICAgICAgICAgdmFyIGNsb3Nlc3QgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhfYXJyYXlCdWZmZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGlmZiA9IE1hdGguYWJzKGNhbGN1bGF0ZWRDaHVua1NpemUgLSBrZXkpO1xuICAgICAgICAgICAgICAgIGlmIChkaWZmIDwgTWF0aC5hYnMoY2FsY3VsYXRlZENodW5rU2l6ZSAtIGNsb3Nlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpeCBmb3Igc3RyYW5nZSBidWcsIHdoZXJlIGtleSBzb21ldGltZXMgaXMgYSBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogaW52ZXN0aWdhdGUgc291cmNlXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Yga2V5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBwYXJzZUludChrZXkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNsb3Nlc3QgPSBrZXk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9pZiB0aGVyZSBpcyBhbHJlYWR5IGEgY2xvc2VyIGNodW5rIHNlbGVjdGVkLCB3ZSBkb24ndCBuZWVkIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgLy9hbnltb3JlIGluIHRoaXMgdGVzdCBhbmQgY2FuIGRlcmVmZXJlbmNlIGl0IHRvIHNhdmUgaGVhcCBtZW1vcnlcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIF9hcnJheUJ1ZmZlcnNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIF9lbmRBcnJheUJ1ZmZlcnNba2V5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY2FsY3VsYXRlZENodW5rU2l6ZSA9IGNsb3Nlc3Q7XG4gICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKFwiZmFsbGJhY2sgdG8gZXhpc3RpbmcgY2h1bmtzaXplIGZvciB1cGNvbWluZyBzcGVlZCB0ZXN0IFwiICsgY2FsY3VsYXRlZENodW5rU2l6ZSAvIDEwMjQgKyBcIiBLQlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBudW1UaHJlYWRzOiB0aHJlYWRzLFxuICAgICAgICAgICAgY2h1bmtTaXplOiBjYWxjdWxhdGVkQ2h1bmtTaXplLFxuICAgICAgICAgICAgYnl0ZXNQZXJTZWNzOiBfdG90YWxCeXRlc1BlclNlY3NQcmV0ZXN0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29uZHVjdCB0aGUgc2hvcnQgcHJldGVzdCB0byByZWNvZ25pemUgaWYgdGhlIGNvbm5lY3Rpb25cbiAgICAgKiBpcyB0b28gc2xvdyBmb3IgbXVsdGlwbGUgdGhyZWFkc1xuICAgICAqIEBwYXJhbSB7Uk1CVFRlc3RUaHJlYWR9IHRocmVhZFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBkdXJhdGlvbk1zXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2hvcnREb3dubG9hZHRlc3QodGhyZWFkLCBkdXJhdGlvbk1zKSB7XG4gICAgICAgIHZhciBwcmV2TGlzdGVuZXIgPSB0aHJlYWQuc29ja2V0Lm9ubWVzc2FnZTtcbiAgICAgICAgdmFyIHN0YXJ0VGltZSA9IG5vd01zKCk7IC8vbXMgc2luY2UgcGFnZSBsb2FkXG4gICAgICAgIHZhciBuID0gMTtcbiAgICAgICAgdmFyIGJ5dGVzUmVjZWl2ZWQgPSAwO1xuICAgICAgICB2YXIgY2h1bmtzaXplID0gX2NodW5rU2l6ZTtcblxuICAgICAgICB2YXIgbG9vcCA9IGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgICAgICAgICBkb3dubG9hZENodW5rcyh0aHJlYWQsIG4sIGNodW5rc2l6ZSwgZnVuY3Rpb24gKG1zZykge1xuICAgICAgICAgICAgICAgIGJ5dGVzUmVjZWl2ZWQgKz0gbiAqIGNodW5rc2l6ZTtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBcIiArIG1zZyk7XG4gICAgICAgICAgICAgICAgdmFyIHRpbWVOcyA9IHBhcnNlSW50KG1zZy5zdWJzdHJpbmcoNSkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5vdyA9IG5vd01zKCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vdyAtIHN0YXJ0VGltZSA+IGR1cmF0aW9uTXMpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9zYXZlIGNpcmNhIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICBfYnl0ZXNQZXJTZWNzUHJldGVzdC5wdXNoKG4gKiBjaHVua3NpemUgLyAodGltZU5zIC8gMWU5KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy9cImJyZWFrXCJcbiAgICAgICAgICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2UgPSBwcmV2TGlzdGVuZXI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG4gPCA4IHx8ICFfY2hhbmdlQ2h1bmtTaXplcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbiA9IG4gKiAyO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9vcCgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2h1bmtzaXplID0gTWF0aC5taW4oY2h1bmtzaXplICogMiwgTUFYX0NIVU5LX1NJWkUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9vcCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgbG9vcCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERvd25sb2FkIG4gQ2h1bmtzIGZyb20gdGhlIHRlc3Qgc2VydmVyXG4gICAgICogQHBhcmFtIHtSTUJUVGVzdFRocmVhZH0gdGhyZWFkIGNvbnRhaW5pbmcgYW4gb3BlbiBzb2NrZXRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gdG90YWwgaG93IG1hbnkgY2h1bmtzIHRvIGRvd25sb2FkXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGNodW5rU2l6ZSBzaXplIG9mIHNpbmdsZSBjaHVuayBpbiBieXRlc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uc3VjY2VzcyBleHBlY3RzIG9uZSBhcmd1bWVudCAoU3RyaW5nKVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGRvd25sb2FkQ2h1bmtzKHRocmVhZCwgdG90YWwsIGNodW5rU2l6ZSwgb25zdWNjZXNzKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coU3RyaW5nLmZvcm1hdChMb2NhbGUuVVMsIFwidGhyZWFkICVkOiBnZXR0aW5nICVkIGNodW5rKHMpXCIsIHRocmVhZElkLCBjaHVua3MpKTtcbiAgICAgICAgdmFyIHNvY2tldCA9IHRocmVhZC5zb2NrZXQ7XG4gICAgICAgIHZhciByZW1haW5pbmdDaHVua3MgPSB0b3RhbDtcbiAgICAgICAgdmFyIGV4cGVjdEJ5dGVzID0gX2NodW5rU2l6ZSAqIHRvdGFsO1xuICAgICAgICB2YXIgdG90YWxSZWFkID0gMDtcbiAgICAgICAgdmFyIGxhc3RCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzMzNzAyODM4L2hvdy10by1hcHBlbmQtYnl0ZXMtbXVsdGktYnl0ZXMtYW5kLWJ1ZmZlci10by1hcnJheWJ1ZmZlci1pbi1qYXZhc2NyaXB0XG4gICAgICAgIHZhciBjb25jYXRCdWZmZXIgPSBmdW5jdGlvbiBjb25jYXRCdWZmZXIoYSwgYikge1xuICAgICAgICAgICAgdmFyIGMgPSBuZXcgVWludDhBcnJheShhLmxlbmd0aCArIGIubGVuZ3RoKTtcbiAgICAgICAgICAgIGMuc2V0KGEsIDApO1xuICAgICAgICAgICAgYy5zZXQoYiwgYS5sZW5ndGgpO1xuICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGRvd25sb2FkQ2h1bmtMaXN0ZW5lciA9IGZ1bmN0aW9uIGRvd25sb2FkQ2h1bmtMaXN0ZW5lcihldmVudCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBldmVudC5kYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGZ1bGxDaHVuayA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAobGFzdEJ1ZmZlciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGxhc3RCdWZmZXIgPSBuZXcgVWludDhBcnJheShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGFzdEJ1ZmZlciA9IGNvbmNhdEJ1ZmZlcihsYXN0QnVmZmVyLCBuZXcgVWludDhBcnJheShldmVudC5kYXRhKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coXCJyZWNlaXZlZCBjaHVuayB3aXRoIFwiICsgbGluZS5sZW5ndGggKyBcIiBieXRlc1wiKTtcbiAgICAgICAgICAgIHRvdGFsUmVhZCA9IHRvdGFsUmVhZCArIGV2ZW50LmRhdGEuYnl0ZUxlbmd0aDtcblxuICAgICAgICAgICAgaWYgKGxhc3RCdWZmZXIubGVuZ3RoID09PSBjaHVua1NpemUpIHtcbiAgICAgICAgICAgICAgICByZW1haW5pbmdDaHVua3MtLTtcbiAgICAgICAgICAgICAgICBmdWxsQ2h1bmsgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL3plcm8ganVua3MgcmVtYWluIC0gZ2V0IHRpbWVcbiAgICAgICAgICAgIGlmIChmdWxsQ2h1bmsgJiYgbGFzdEJ1ZmZlcltsYXN0QnVmZmVyLmxlbmd0aCAtIDFdID09PSAweEZGKSB7XG4gICAgICAgICAgICAgICAgLy9nZXQgaW5mb1xuICAgICAgICAgICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAobGluZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5mb21zZyA9IGxpbmUuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgb25zdWNjZXNzKGluZm9tc2cpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChcIk9LXFxuXCIpO1xuICAgICAgICAgICAgICAgIF9lbmRBcnJheUJ1ZmZlcnNbY2h1bmtTaXplXSA9IGxhc3RCdWZmZXIuYnVmZmVyO1xuICAgICAgICAgICAgICAgIGxhc3RCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIV9hcnJheUJ1ZmZlcnMuaGFzT3duUHJvcGVydHkoY2h1bmtTaXplKSkge1xuICAgICAgICAgICAgICAgICAgICBfYXJyYXlCdWZmZXJzW2NodW5rU2l6ZV0gPSBbXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGZ1bGxDaHVuaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoX2FycmF5QnVmZmVyc1tjaHVua1NpemVdLmxlbmd0aCA8IF9ybWJ0VGVzdENvbmZpZy5zYXZlZENodW5rcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2FycmF5QnVmZmVyc1tjaHVua1NpemVdLnB1c2gobGFzdEJ1ZmZlci5idWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxhc3RCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGRvd25sb2FkQ2h1bmtMaXN0ZW5lcjtcbiAgICAgICAgX2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogZG93bmxvYWRpbmcgXCIgKyB0b3RhbCArIFwiIGNodW5rcywgXCIgKyBleHBlY3RCeXRlcyAvIDEwMDAgKyBcIiBLQlwiKTtcbiAgICAgICAgdmFyIHNlbmQgPSBcIkdFVENIVU5LUyBcIiArIHRvdGFsICsgKGNodW5rU2l6ZSAhPT0gREVGQVVMVF9DSFVOS19TSVpFID8gXCIgXCIgKyBjaHVua1NpemUgOiBcIlwiKSArIFwiXFxuXCI7XG4gICAgICAgIHNvY2tldC5zZW5kKHNlbmQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBpbmdUZXN0KHRocmVhZCkge1xuICAgICAgICB2YXIgcHJldkxpc3RlbmVyID0gdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2U7XG4gICAgICAgIHZhciBwaW5nc1JlbWFpbmluZyA9IF9ybWJ0VGVzdENvbmZpZy5udW1QaW5ncztcbiAgICAgICAgdmFyIHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXG4gICAgICAgIHZhciBvbnN1Y2Nlc3MgPSBmdW5jdGlvbiBvbnN1Y2Nlc3MocGluZ1Jlc3VsdCkge1xuICAgICAgICAgICAgdGhyZWFkLnJlc3VsdC5waW5ncy5wdXNoKHBpbmdSZXN1bHQpO1xuICAgICAgICAgICAgX3JtYnRUZXN0UmVzdWx0LnBpbmdzID0gW10uY29uY2F0KF90b0NvbnN1bWFibGVBcnJheSh0aHJlYWQucmVzdWx0LnBpbmdzKSk7XG5cbiAgICAgICAgICAgIC8vdXNlIGZpcnN0IHR3byBwaW5ncyB0byBkbyBhIGJldHRlciBhcHByb3hpbWF0aW9uIG9mIHRoZSByZW1haW5pbmcgdGltZVxuICAgICAgICAgICAgaWYgKHBpbmdzUmVtYWluaW5nID09PSBfcm1idFRlc3RDb25maWcubnVtUGluZ3MgLSAxKSB7XG4gICAgICAgICAgICAgICAgLy9QSU5HIC0+IFBPTkcgLT4gT0sgLT4gVElNRSAtPiBBQ0NFUFQgLi4uIC0+IFBJTkcgLT4gLi4uXG4gICAgICAgICAgICAgICAgX3N0YXRlc0luZm8uZHVyYXRpb25QaW5nTXMgPSAodGhyZWFkLnJlc3VsdC5waW5nc1sxXS50aW1lTnMgLSB0aHJlYWQucmVzdWx0LnBpbmdzWzBdLnRpbWVOcykgLyAxZTYgKiBfcm1idFRlc3RDb25maWcubnVtUGluZ3M7XG4gICAgICAgICAgICAgICAgX2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogUElORyBwaGFzZSB3aWxsIHRha2UgYXBwcm94IFwiICsgX3N0YXRlc0luZm8uZHVyYXRpb25QaW5nTXMgKyBcIiBtc1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogUElORyBcIiArIHBpbmdSZXN1bHQuY2xpZW50ICsgXCIgbnMgY2xpZW50OyBcIiArIHBpbmdSZXN1bHQuc2VydmVyICsgXCIgbnMgc2VydmVyXCIpO1xuXG4gICAgICAgICAgICBwaW5nc1JlbWFpbmluZy0tO1xuXG4gICAgICAgICAgICAvL2F0IGxlYXN0IG9uZSwgaWYgd2Ugd2FudCB0byByZXBlYXQgcGluZyBmb3IgYSBjZXJ0YWluIGludGVydmFsXG4gICAgICAgICAgICBpZiAoX3JtYnRUZXN0Q29uZmlnLmRvUGluZ0ludGVydmFsTWlsbGlzZWNvbmRzID4gMCAmJiBwaW5nc1JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50VGltZSAtIHN0YXJ0VGltZSA8IF9ybWJ0VGVzdENvbmZpZy5kb1BpbmdJbnRlcnZhbE1pbGxpc2Vjb25kcykge1xuICAgICAgICAgICAgICAgICAgICBwaW5nc1JlbWFpbmluZyA9IDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGluZ3NSZW1haW5pbmcgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy93YWl0IGZvciBuZXcgJ0FDQ0VQVCctbWVzc2FnZVxuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChldmVudC5kYXRhID09PSBcIkFDQ0VQVCBHRVRDSFVOS1MgR0VUVElNRSBQVVQgUFVUTk9SRVNVTFQgUElORyBRVUlUXFxuXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBpbmcodGhyZWFkLCBvbnN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5lcnJvcihcInVuZXhwZWN0ZWQgZXJyb3IgZHVyaW5nIHBpbmcgdGVzdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vXCJicmVha1xuXG4gICAgICAgICAgICAgICAgLy9tZWRpYW4gcGluZ1xuICAgICAgICAgICAgICAgIHZhciB0QXJyYXlDbGllbnQgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRocmVhZC5yZXN1bHQucGluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdEFycmF5Q2xpZW50LnB1c2godGhyZWFkLnJlc3VsdC5waW5nc1tpXS5jbGllbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfcm1idFRlc3RSZXN1bHQucGluZ19jbGllbnRfbWVkaWFuID0gTWF0aC5tZWRpYW4odEFycmF5Q2xpZW50KTtcbiAgICAgICAgICAgICAgICBfcm1idFRlc3RSZXN1bHQucGluZ19jbGllbnRfc2hvcnRlc3QgPSBNYXRoLm1pbi5hcHBseShNYXRoLCB0QXJyYXlDbGllbnQpO1xuXG4gICAgICAgICAgICAgICAgdmFyIHRBcnJheVNlcnZlciA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCB0aHJlYWQucmVzdWx0LnBpbmdzLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgICAgICB0QXJyYXlTZXJ2ZXIucHVzaCh0aHJlYWQucmVzdWx0LnBpbmdzW19pXS5zZXJ2ZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIF9ybWJ0VGVzdFJlc3VsdC5waW5nX3NlcnZlcl9tZWRpYW4gPSBNYXRoLm1lZGlhbih0QXJyYXlTZXJ2ZXIpO1xuICAgICAgICAgICAgICAgIF9ybWJ0VGVzdFJlc3VsdC5waW5nX3NlcnZlcl9zaG9ydGVzdCA9IE1hdGgubWluLmFwcGx5KE1hdGgsIHRBcnJheVNlcnZlcik7XG5cbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBtZWRpYW4gY2xpZW50OiBcIiArIE1hdGgucm91bmQoX3JtYnRUZXN0UmVzdWx0LnBpbmdfY2xpZW50X21lZGlhbiAvIDFlMykgLyAxZTMgKyBcIiBtczsgXCIgKyBcIm1lZGlhbiBzZXJ2ZXI6IFwiICsgTWF0aC5yb3VuZChfcm1idFRlc3RSZXN1bHQucGluZ19zZXJ2ZXJfbWVkaWFuIC8gMWUzKSAvIDFlMyArIFwiIG1zXCIpO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IHNob3J0ZXN0IGNsaWVudDogXCIgKyBNYXRoLnJvdW5kKF9ybWJ0VGVzdFJlc3VsdC5waW5nX2NsaWVudF9zaG9ydGVzdCAvIDFlMykgLyAxZTMgKyBcIiBtczsgXCIgKyBcInNob3J0ZXN0IHNlcnZlcjogXCIgKyBNYXRoLnJvdW5kKF9ybWJ0VGVzdFJlc3VsdC5waW5nX3NlcnZlcl9zaG9ydGVzdCAvIDFlMykgLyAxZTMgKyBcIiBtc1wiKTtcblxuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25tZXNzYWdlID0gcHJldkxpc3RlbmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBwaW5nKHRocmVhZCwgb25zdWNjZXNzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Uk1CVFRlc3RUaHJlYWR9IHRocmVhZFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uc3VjY2VzcyB1cG9uIHN1Y2Nlc3NcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBwaW5nKHRocmVhZCwgb25zdWNjZXNzKSB7XG4gICAgICAgIHZhciBiZWdpbiA9IHZvaWQgMDtcbiAgICAgICAgdmFyIGNsaWVudER1cmF0aW9uID0gdm9pZCAwO1xuICAgICAgICB2YXIgcGluZ0xpc3RlbmVyID0gZnVuY3Rpb24gcGluZ0xpc3RlbmVyKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuZGF0YSA9PT0gXCJQT05HXFxuXCIpIHtcbiAgICAgICAgICAgICAgICB2YXIgZW5kID0gbm93TnMoKTtcbiAgICAgICAgICAgICAgICBjbGllbnREdXJhdGlvbiA9IGVuZCAtIGJlZ2luO1xuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQuc2VuZChcIk9LXFxuXCIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmluZGV4T2YoXCJUSU1FXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBSTUJUUGluZ1Jlc3VsdCgpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5jbGllbnQgPSBjbGllbnREdXJhdGlvbjtcbiAgICAgICAgICAgICAgICByZXN1bHQuc2VydmVyID0gcGFyc2VJbnQoZXZlbnQuZGF0YS5zdWJzdHJpbmcoNSkpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC50aW1lTnMgPSBiZWdpbjtcbiAgICAgICAgICAgICAgICBvbnN1Y2Nlc3MocmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2UgPSBwaW5nTGlzdGVuZXI7XG5cbiAgICAgICAgYmVnaW4gPSBub3dOcygpO1xuICAgICAgICB0aHJlYWQuc29ja2V0LnNlbmQoXCJQSU5HXFxuXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSTUJUVGVzdFRocmVhZH0gdGhyZWFkXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGR1cmF0aW9uIGluIHNlY29uZHNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkb3dubG9hZFRlc3QodGhyZWFkLCBkdXJhdGlvbikge1xuICAgICAgICB2YXIgcHJldmlvdXNMaXN0ZW5lciA9IHRocmVhZC5zb2NrZXQub25tZXNzYWdlO1xuICAgICAgICB2YXIgdG90YWxSZWFkID0gMDtcbiAgICAgICAgdmFyIHJlYWRDaHVua3MgPSAwO1xuICAgICAgICB2YXIgbGFzdFJlcG9ydGVkQ2h1bmtzID0gLTE7XG5cbiAgICAgICAgdmFyIGludGVydmFsID0gdm9pZCAwO1xuICAgICAgICB2YXIgbGFzdFJlYWQgPSB2b2lkIDA7XG4gICAgICAgIHZhciBsYXN0Q2h1bmsgPSBudWxsO1xuICAgICAgICB2YXIgbGFzdFRpbWUgPSBudWxsO1xuXG4gICAgICAgIC8vcmVhZCBjaHVuayBvbmx5IGF0IHNvbWUgcG9pbnQgaW4gdGhlIGZ1dHVyZSB0byBzYXZlIHJlc291cmNlc1xuICAgICAgICBpbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAobGFzdENodW5rID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL25vdGhpbmcgbmV3IGhhcHBlbmVkLCBkbyBub3Qgc2ltdWxhdGUgYW4gYWNjdXJhY3kgdGhhdCBkb2VzIG5vdCBleGlzdFxuICAgICAgICAgICAgaWYgKGxhc3RSZXBvcnRlZENodW5rcyA9PT0gcmVhZENodW5rcykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxhc3RSZXBvcnRlZENodW5rcyA9IHJlYWRDaHVua3M7XG5cbiAgICAgICAgICAgIHZhciBub3cgPSBub3dOcygpO1xuICAgICAgICAgICAgX2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogXCIgKyBsYXN0UmVhZCArIFwifFwiICsgX3JtYnRUZXN0Q29uZmlnLm1lYXN1cmVtZW50UG9pbnRzVGltZXNwYW4gKyBcInxcIiArIG5vdyArIFwifFwiICsgcmVhZENodW5rcyk7XG5cbiAgICAgICAgICAgIHZhciBsYXN0Qnl0ZSA9IG5ldyBVaW50OEFycmF5KGxhc3RDaHVuaywgbGFzdENodW5rLmJ5dGVMZW5ndGggLSAxLCAxKTtcblxuICAgICAgICAgICAgLy9hZGQgcmVzdWx0XG4gICAgICAgICAgICB2YXIgZHVyYXRpb24gPSBsYXN0VGltZSAtIHN0YXJ0O1xuICAgICAgICAgICAgdGhyZWFkLnJlc3VsdC5kb3duLnB1c2goe1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbixcbiAgICAgICAgICAgICAgICBieXRlczogdG90YWxSZWFkXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy9sZXQgbm93ID0gbm93TnMoKTtcbiAgICAgICAgICAgIGxhc3RSZWFkID0gbm93O1xuXG4gICAgICAgICAgICBpZiAobGFzdEJ5dGVbMF0gPj0gMHhGRikge1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IHJlY2VpdmVkIGVuZCBjaHVua1wiKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG5cbiAgICAgICAgICAgICAgICAvL2xhc3QgY2h1bmsgcmVjZWl2ZWQgLSBnZXQgdGltZVxuICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vVElNRVxuICAgICAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0Lm9ubWVzc2FnZSA9IHByZXZpb3VzTGlzdGVuZXI7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0LnNlbmQoXCJPS1xcblwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgX3JtYnRUZXN0Q29uZmlnLm1lYXN1cmVtZW50UG9pbnRzVGltZXNwYW4pO1xuXG4gICAgICAgIHZhciBkb3dubG9hZExpc3RlbmVyID0gZnVuY3Rpb24gZG93bmxvYWRMaXN0ZW5lcihldmVudCkge1xuICAgICAgICAgICAgcmVhZENodW5rcysrO1xuICAgICAgICAgICAgdG90YWxSZWFkICs9IGV2ZW50LmRhdGEuYnl0ZUxlbmd0aDsgLy9hcnJheUJ1ZmZlclxuICAgICAgICAgICAgbGFzdFRpbWUgPSBub3dOcygpO1xuXG4gICAgICAgICAgICBsYXN0Q2h1bmsgPSBldmVudC5kYXRhO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRocmVhZC5zb2NrZXQub25tZXNzYWdlID0gZG93bmxvYWRMaXN0ZW5lcjtcblxuICAgICAgICB2YXIgc3RhcnQgPSBub3dOcygpO1xuICAgICAgICB0aHJlYWQuc29ja2V0LnNlbmQoXCJHRVRUSU1FIFwiICsgZHVyYXRpb24gKyAoX2NodW5rU2l6ZSAhPT0gREVGQVVMVF9DSFVOS19TSVpFID8gXCIgXCIgKyBfY2h1bmtTaXplIDogXCJcIikgKyBcIlxcblwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAqIGNvbmR1Y3QgdGhlIHNob3J0IHByZXRlc3QgdG8gcmVjb2duaXplIGlmIHRoZSBjb25uZWN0aW9uXG4gICAgKiBpcyB0b28gc2xvdyBmb3IgbXVsdGlwbGUgdGhyZWFkc1xuICAgICogQHBhcmFtIHtSTUJUVGVzdFRocmVhZH0gdGhyZWFkXG4gICAgKiBAcGFyYW0ge051bWJlcn0gZHVyYXRpb25Nc1xuICAgICovXG4gICAgZnVuY3Rpb24gc2hvcnRVcGxvYWR0ZXN0KHRocmVhZCwgZHVyYXRpb25Ncykge1xuICAgICAgICB2YXIgcHJldkxpc3RlbmVyID0gdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2U7XG4gICAgICAgIHZhciBzdGFydFRpbWUgPSBub3dNcygpOyAvL21zIHNpbmNlIHBhZ2UgbG9hZFxuICAgICAgICB2YXIgbiA9IDE7XG4gICAgICAgIHZhciBieXRlc1NlbnQgPSAwO1xuICAgICAgICB2YXIgY2h1bmtTaXplID0gX2NodW5rU2l6ZTtcblxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZW5kVGltZSA9IG5vd01zKCk7XG4gICAgICAgICAgICB2YXIgZHVyYXRpb24gPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgX2xvZ2dlci5kZWJ1ZyhcImRpZmY6XCIgKyAoZHVyYXRpb24gLSBkdXJhdGlvbk1zKSArIFwiIChcIiArIChkdXJhdGlvbiAtIGR1cmF0aW9uTXMpIC8gZHVyYXRpb25NcyArIFwiICUpXCIpO1xuICAgICAgICB9LCBkdXJhdGlvbk1zKTtcblxuICAgICAgICB2YXIgbG9vcCA9IGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgICAgICAgICB1cGxvYWRDaHVua3ModGhyZWFkLCBuLCBjaHVua1NpemUsIGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgICAgICAgICAgICBieXRlc1NlbnQgKz0gbiAqIGNodW5rU2l6ZTtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBcIiArIG1zZyk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbm93ID0gbm93TXMoKTtcbiAgICAgICAgICAgICAgICBpZiAobm93IC0gc3RhcnRUaW1lID4gZHVyYXRpb25Ncykge1xuICAgICAgICAgICAgICAgICAgICAvL1wiYnJlYWtcIlxuICAgICAgICAgICAgICAgICAgICB0aHJlYWQuc29ja2V0Lm9ubWVzc2FnZSA9IHByZXZMaXN0ZW5lcjtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdGltZU5zID0gcGFyc2VJbnQobXNnLnN1YnN0cmluZyg1KSk7IC8vMWU5XG5cbiAgICAgICAgICAgICAgICAgICAgLy9zYXZlIGNpcmNhIHJlc3VsdFxuICAgICAgICAgICAgICAgICAgICBfYnl0ZXNQZXJTZWNzUHJldGVzdC5wdXNoKG4gKiBjaHVua1NpemUgLyAodGltZU5zIC8gMWU5KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9pbmNyZWFzZSBjaHVuayBzaXplIG9ubHkgaWYgdGhlcmUgYXJlIHNhdmVkIGNodW5rcyBmb3IgaXQhXG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdDaHVua1NpemUgPSBjaHVua1NpemUgKiAyO1xuICAgICAgICAgICAgICAgICAgICBpZiAobiA8IDggfHwgIV9lbmRBcnJheUJ1ZmZlcnMuaGFzT3duUHJvcGVydHkobmV3Q2h1bmtTaXplKSB8fCAhX2NoYW5nZUNodW5rU2l6ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG4gPSBuICogMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNodW5rU2l6ZSA9IE1hdGgubWluKGNodW5rU2l6ZSAqIDIsIE1BWF9DSFVOS19TSVpFKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBsb29wKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBsb2FkIG4gQ2h1bmtzIHRvIHRoZSB0ZXN0IHNlcnZlclxuICAgICAqIEBwYXJhbSB7Uk1CVFRlc3RUaHJlYWR9IHRocmVhZCBjb250YWluaW5nIGFuIG9wZW4gc29ja2V0XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHRvdGFsIGhvdyBtYW55IGNodW5rcyB0byB1cGxvYWRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gY2h1bmtTaXplIHNpemUgb2Ygc2luZ2xlIGNodW5rIGluIGJ5dGVzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25zdWNjZXNzIGV4cGVjdHMgb25lIGFyZ3VtZW50IChTdHJpbmcpXG4gICAgICovXG4gICAgZnVuY3Rpb24gdXBsb2FkQ2h1bmtzKHRocmVhZCwgdG90YWwsIGNodW5rU2l6ZSwgb25zdWNjZXNzKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coU3RyaW5nLmZvcm1hdChMb2NhbGUuVVMsIFwidGhyZWFkICVkOiBnZXR0aW5nICVkIGNodW5rKHMpXCIsIHRocmVhZElkLCBjaHVua3MpKTtcbiAgICAgICAgdmFyIHNvY2tldCA9IHRocmVhZC5zb2NrZXQ7XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmRhdGEuaW5kZXhPZihcIk9LXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgLy9iZWZvcmUgd2Ugc3RhcnQgdGhlIHRlc3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRhdGEuaW5kZXhPZihcIkFDQ0VQVFwiKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIC8vc3RhdHVzIGxpbmUgYWZ0ZXIgdGhlIHRlc3QgLSBpZ25vcmUgaGVyZSBmb3Igbm93XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvbnN1Y2Nlc3MoZXZlbnQuZGF0YSk7IC8vVElNRSB4eHh4XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgX2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogdXBsb2FkaW5nIFwiICsgdG90YWwgKyBcIiBjaHVua3MsIFwiICsgY2h1bmtTaXplICogdG90YWwgLyAxMDAwICsgXCIgS0JcIik7XG4gICAgICAgIHNvY2tldC5zZW5kKFwiUFVUTk9SRVNVTFRcIiArIChfY2hhbmdlQ2h1bmtTaXplcyA/IFwiIFwiICsgY2h1bmtTaXplIDogXCJcIikgKyBcIlxcblwiKTsgLy9QdXQgbm8gcmVzdWx0XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG90YWw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGJsb2IgPSB2b2lkIDA7XG4gICAgICAgICAgICBpZiAoaSA9PT0gdG90YWwgLSAxKSB7XG4gICAgICAgICAgICAgICAgYmxvYiA9IF9lbmRBcnJheUJ1ZmZlcnNbY2h1bmtTaXplXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmxvYiA9IF9hcnJheUJ1ZmZlcnNbY2h1bmtTaXplXVswXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNvY2tldC5zZW5kKGJsb2IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JNQlRUZXN0VGhyZWFkfSB0aHJlYWRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gZHVyYXRpb24gaW4gc2Vjb25kc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHVwbG9hZFRlc3QodGhyZWFkLCBkdXJhdGlvbikge1xuICAgICAgICB2YXIgcHJldmlvdXNMaXN0ZW5lciA9IHRocmVhZC5zb2NrZXQub25tZXNzYWdlO1xuXG4gICAgICAgIC8vaWYgbGVzcyB0aGFuIGFwcHJveCBoYWxmIGEgc2Vjb25kIGlzIGxlZnQgaW4gdGhlIGJ1ZmZlciAtIHJlc2VuZCFcbiAgICAgICAgdmFyIGZpeGVkVW5kZXJydW5CeXRlc1Zpc2libGUgPSBfdG90YWxCeXRlc1BlclNlY3NQcmV0ZXN0IC8gMiAvIF9udW1VcGxvYWRUaHJlYWRzO1xuICAgICAgICAvL2lmIGxlc3MgdGhhbiBhcHByb3ggMS41IHNlY29uZHMgaXMgbGVmdCBpbiB0aGUgYnVmZmVyIC0gcmVzZW5kISAoc2luY2UgYnJvd3NlciBsaW1pdCBzZXRUaW1lb3V0LWludGVydmFsc1xuICAgICAgICAvLyAgd2hlbiBwYWdlcyBhcmUgbm90IGluIHRoZSBmb3JlZ3JvdW5kKVxuICAgICAgICB2YXIgZml4ZWRVbmRlcnJ1bkJ5dGVzSGlkZGVuID0gX3RvdGFsQnl0ZXNQZXJTZWNzUHJldGVzdCAqIDEuNSAvIF9udW1VcGxvYWRUaHJlYWRzO1xuICAgICAgICB2YXIgZml4ZWRVbmRlcnJ1bkJ5dGVzID0gZG9jdW1lbnQuaGlkZGVuID8gZml4ZWRVbmRlcnJ1bkJ5dGVzSGlkZGVuIDogZml4ZWRVbmRlcnJ1bkJ5dGVzVmlzaWJsZTtcblxuICAgICAgICB2YXIgdmlzaWJpbGl0eUNoYW5nZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiB2aXNpYmlsaXR5Q2hhbmdlRXZlbnRMaXN0ZW5lcigpIHtcbiAgICAgICAgICAgIGZpeGVkVW5kZXJydW5CeXRlcyA9IGRvY3VtZW50LmhpZGRlbiA/IGZpeGVkVW5kZXJydW5CeXRlc0hpZGRlbiA6IGZpeGVkVW5kZXJydW5CeXRlc1Zpc2libGU7XG4gICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKFwiZG9jdW1lbnQgdmlzaWJpbGl0eSBjaGFuZ2VkIHRvOiBcIiArIGRvY3VtZW50LmhpZGRlbik7XG4gICAgICAgIH07XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJ2aXNpYmlsaXR5Y2hhbmdlXCIsIHZpc2liaWxpdHlDaGFuZ2VFdmVudExpc3RlbmVyKTtcblxuICAgICAgICAvL3NlbmQgZGF0YSBmb3IgYXBwcm94IG9uZSBzZWNvbmQgYXQgb25jZVxuICAgICAgICAvL0BUT0RPIGFkYXB0IHdpdGggY2hhbmdpbmcgY29ubmVjdGlvbiBzcGVlZHNcbiAgICAgICAgdmFyIHNlbmRBdE9uY2VDaHVua3MgPSBNYXRoLmNlaWwoX3RvdGFsQnl0ZXNQZXJTZWNzUHJldGVzdCAvIF9udW1VcGxvYWRUaHJlYWRzIC8gX2NodW5rU2l6ZSk7XG5cbiAgICAgICAgdmFyIHJlY2VpdmVkRW5kVGltZSA9IGZhbHNlO1xuICAgICAgICB2YXIga2VlcFNlbmRpbmdEYXRhID0gdHJ1ZTtcblxuICAgICAgICB2YXIgbGFzdER1cmF0aW9uSW5mbyA9IC0xO1xuICAgICAgICB2YXIgdGltZW91dEV4dGVuc2lvbnNNcyA9IDA7XG5cbiAgICAgICAgdmFyIHRpbWVvdXRGdW5jdGlvbiA9IGZ1bmN0aW9uIHRpbWVvdXRGdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmICghcmVjZWl2ZWRFbmRUaW1lKSB7XG4gICAgICAgICAgICAgICAgLy9jaGVjayBob3cgZmFyIHdlIGFyZSBpblxuICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IGlzIDcuMiBzZWMgaW4sIGdvdCBkYXRhIGZvciBcIiArIGxhc3REdXJhdGlvbkluZm8pO1xuICAgICAgICAgICAgICAgIC8vaWYgbWVhc3VyZW1lbnRzIGFyZSBmb3IgPCA3c2VjLCBnaXZlIGl0IHRpbWVcbiAgICAgICAgICAgICAgICBpZiAobGFzdER1cmF0aW9uSW5mbyA8IGR1cmF0aW9uICogMWU5ICYmIHRpbWVvdXRFeHRlbnNpb25zTXMgPCAzMDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRpbWVvdXRGdW5jdGlvbiwgMjUwKTtcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dEV4dGVuc2lvbnNNcyArPSAyNTA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy9raWxsIGl0IHdpdGggZm9yY2UhXG4gICAgICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IGRpZG4ndCBmaW5pc2gsIHRpbWVvdXQgZXh0ZW5kZWQgYnkgXCIgKyB0aW1lb3V0RXh0ZW5zaW9uc01zICsgXCIgbXMsIGxhc3QgaW5mbyBmb3IgXCIgKyBsYXN0RHVyYXRpb25JbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vZG8gbm90aGluZywgd2Uga2lsbCBpdCBvbiBwdXJwb3NlXG4gICAgICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2UgPSBwcmV2aW91c0xpc3RlbmVyO1xuICAgICAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRocmVhZC5pZCArIFwiOiBzb2NrZXQgbm93IGNsb3NlZDogXCIgKyB0aHJlYWQuc29ja2V0LnJlYWR5U3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwidmlzaWJpbGl0eWNoYW5nZVwiLCB2aXNpYmlsaXR5Q2hhbmdlRXZlbnRMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgICAgIHRocmVhZC50cmlnZ2VyTmV4dFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdXBsb2FkIGZ1bmN0aW9uIGZvciBhIGZldyBjaHVua3MgYXQgYSB0aW1lLCBlbmNvZGVkIGFzIGEgY2FsbGJhY2sgaW5zdGVhZCBvZiBhIGxvb3AuXG4gICAgICAgICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uZHQtcHJvamVjdC9uZHQvYmxvYi9tYXN0ZXIvSFRNTDUtZnJvbnRlbmQvbmR0LWJyb3dzZXItY2xpZW50LmpzXG4gICAgICAgICAqL1xuICAgICAgICB2YXIgc2VuZENodW5rcyA9IGZ1bmN0aW9uIHNlbmRDaHVua3MoKSB7XG4gICAgICAgICAgICAvLyBNb25pdG9yIHRoZSBidWZmZXJzaXplIGFzIGl0IHNlbmRzIGFuZCByZWZpbGwgaWYgaXQgZ2V0cyB0b28gbG93LlxuICAgICAgICAgICAgaWYgKHRocmVhZC5zb2NrZXQuYnVmZmVyZWRBbW91bnQgPCBmaXhlZFVuZGVycnVuQnl0ZXMpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogYnVmZmVyIHVuZGVycnVuXCIpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VuZEF0T25jZUNodW5rczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocmVhZC5zb2NrZXQuc2VuZChfYXJyYXlCdWZmZXJzW19jaHVua1NpemVdW2kgJSBfYXJyYXlCdWZmZXJzW19jaHVua1NpemVdLmxlbmd0aF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IG5vIGJ1ZmZlciB1bmRlcnJ1blwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGtlZXBTZW5kaW5nRGF0YSkge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoc2VuZENodW5rcywgMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAvL3NldCB0aW1lb3V0IGZ1bmN0aW9uIGFmdGVyIDcsMnMgdG8gY2hlY2sgaWYgZXZlcnl0aGluZyB3ZW50IGFjY29yZGluZyB0byBwbGFuXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRpbWVvdXRGdW5jdGlvbiwgZHVyYXRpb24gKiAxZTMgKyAyMDApO1xuXG4gICAgICAgIC8vc2VuZCBlbmQgYmxvYiBhZnRlciA3cywgcXVpdFxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBrZWVwU2VuZGluZ0RhdGEgPSBmYWxzZTtcbiAgICAgICAgICAgIHRocmVhZC5zb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5zZW5kKF9lbmRBcnJheUJ1ZmZlcnNbX2NodW5rU2l6ZV0pO1xuICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5zZW5kKFwiUVVJVFxcblwiKTtcbiAgICAgICAgfSwgZHVyYXRpb24gKiAxZTMpO1xuXG4gICAgICAgIF9sb2dnZXIuZGVidWcodGhyZWFkLmlkICsgXCI6IHNldCB0aW1lb3V0XCIpO1xuXG4gICAgICAgIC8vIG1zIC0+IG5zXG4gICAgICAgIHZhciB0aW1lc3BhbiA9IF9ybWJ0VGVzdENvbmZpZy5tZWFzdXJlbWVudFBvaW50c1RpbWVzcGFuICogMWU2O1xuICAgICAgICB2YXIgcGF0dGVybiA9IC9USU1FIChcXGQrKSBCWVRFUyAoXFxkKykvO1xuICAgICAgICB2YXIgcGF0dGVybkVuZCA9IC9USU1FIChcXGQrKS87XG4gICAgICAgIHZhciB1cGxvYWRMaXN0ZW5lciA9IGZ1bmN0aW9uIHVwbG9hZExpc3RlbmVyKGV2ZW50KSB7XG4gICAgICAgICAgICAvL3N0YXJ0IGNvbmR1Y3RpbmcgdGhlIHRlc3RcbiAgICAgICAgICAgIGlmIChldmVudC5kYXRhID09PSBcIk9LXFxuXCIpIHtcbiAgICAgICAgICAgICAgICBzZW5kQ2h1bmtzKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vaW50ZXJtZWRpYXRlIHJlc3VsdCAtIHNhdmUgaXQhXG4gICAgICAgICAgICAvL1RJTUUgNjk3ODQxNDgyOSBCWVRFUyA1NzM4NDk2XG4gICAgICAgICAgICAvL2xvZ2dlci5kZWJ1Zyh0aHJlYWQuaWQgKyBcIjogcmVjOiBcIiArIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgdmFyIG1hdGNoZXMgPSBwYXR0ZXJuLmV4ZWMoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAobWF0Y2hlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbjogcGFyc2VJbnQobWF0Y2hlc1sxXSksXG4gICAgICAgICAgICAgICAgICAgIGJ5dGVzOiBwYXJzZUludChtYXRjaGVzWzJdKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuZHVyYXRpb24gLSBsYXN0RHVyYXRpb25JbmZvID4gdGltZXNwYW4pIHtcbiAgICAgICAgICAgICAgICAgICAgbGFzdER1cmF0aW9uSW5mbyA9IGRhdGEuZHVyYXRpb247XG4gICAgICAgICAgICAgICAgICAgIC8vZGVidWcodGhyZWFkLmlkICsgXCI6IFwiICsgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICAgICAgICAgICAgICB0aHJlYWQucmVzdWx0LnVwLnB1c2goZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtYXRjaGVzID0gcGF0dGVybkVuZC5leGVjKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vc3RhdGlzdGljIGZvciBlbmQgbWF0Y2ggLSB1cGxvYWQgcGhhc2UgY29tcGxldGVcbiAgICAgICAgICAgICAgICAgICAgcmVjZWl2ZWRFbmRUaW1lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgX2xvZ2dlci5kZWJ1ZyhcIlVwbG9hZCBkdXJhdGlvbjogXCIgKyBtYXRjaGVzWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyZWFkLnNvY2tldC5vbm1lc3NhZ2UgPSBwcmV2aW91c0xpc3RlbmVyO1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwidmlzaWJpbGl0eWNoYW5nZVwiLCB2aXNpYmlsaXR5Q2hhbmdlRXZlbnRMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aHJlYWQuc29ja2V0Lm9ubWVzc2FnZSA9IHVwbG9hZExpc3RlbmVyO1xuXG4gICAgICAgIHRocmVhZC5zb2NrZXQuc2VuZChcIlBVVFwiICsgKF9jaHVua1NpemUgIT09IERFRkFVTFRfQ0hVTktfU0laRSA/IFwiIFwiICsgX2NodW5rU2l6ZSA6IFwiXCIpICsgXCJcXG5cIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2F0aGVyIHRlc3QgcmVzdWx0IGFuZCBwcmVwYXJlIGRhdGEgdG8gYmUgc2VudCB0byBzZXJ2ZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Uk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZX0gcmVnaXN0cmF0aW9uUmVzcG9uc2VcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFRlc3QgcmVzdWx0IHRvIHNlbmQgdG8gc2VydmVyXG4gICAgICovXG4gICAgZnVuY3Rpb24gcHJlcGFyZVJlc3VsdChyZWdpc3RyYXRpb25SZXNwb25zZSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2xpZW50X2xhbmd1YWdlOiBcImRlXCIsXG4gICAgICAgICAgICBjbGllbnRfbmFtZTogX3JtYnRUZXN0Q29uZmlnLmNsaWVudCxcbiAgICAgICAgICAgIGNsaWVudF91dWlkOiBfcm1idFRlc3RDb25maWcudXVpZCxcbiAgICAgICAgICAgIGNsaWVudF92ZXJzaW9uOiBfcm1idFRlc3RDb25maWcuY2xpZW50X3ZlcnNpb24sXG4gICAgICAgICAgICBjbGllbnRfc29mdHdhcmVfdmVyc2lvbjogX3JtYnRUZXN0Q29uZmlnLmNsaWVudF9zb2Z0d2FyZV92ZXJzaW9uLFxuICAgICAgICAgICAgZ2VvTG9jYXRpb25zOiBfcm1idFRlc3RSZXN1bHQuZ2VvTG9jYXRpb25zLFxuICAgICAgICAgICAgbW9kZWw6IF9ybWJ0VGVzdENvbmZpZy5tb2RlbCxcbiAgICAgICAgICAgIG5ldHdvcmtfdHlwZTogOTgsXG4gICAgICAgICAgICBwbGF0Zm9ybTogX3JtYnRUZXN0Q29uZmlnLnBsYXRmb3JtLFxuICAgICAgICAgICAgcHJvZHVjdDogX3JtYnRUZXN0Q29uZmlnLnByb2R1Y3QsXG4gICAgICAgICAgICBwaW5nczogX3JtYnRUZXN0UmVzdWx0LnBpbmdzLFxuICAgICAgICAgICAgdGVzdF9ieXRlc19kb3dubG9hZDogX3JtYnRUZXN0UmVzdWx0LmJ5dGVzX2Rvd25sb2FkLFxuICAgICAgICAgICAgdGVzdF9ieXRlc191cGxvYWQ6IF9ybWJ0VGVzdFJlc3VsdC5ieXRlc191cGxvYWQsXG4gICAgICAgICAgICB0ZXN0X25zZWNfZG93bmxvYWQ6IF9ybWJ0VGVzdFJlc3VsdC5uc2VjX2Rvd25sb2FkLFxuICAgICAgICAgICAgdGVzdF9uc2VjX3VwbG9hZDogX3JtYnRUZXN0UmVzdWx0Lm5zZWNfdXBsb2FkLFxuICAgICAgICAgICAgdGVzdF9udW1fdGhyZWFkczogX251bURvd25sb2FkVGhyZWFkcyxcbiAgICAgICAgICAgIG51bV90aHJlYWRzX3VsOiBfbnVtVXBsb2FkVGhyZWFkcyxcbiAgICAgICAgICAgIHRlc3RfcGluZ19zaG9ydGVzdDogX3JtYnRUZXN0UmVzdWx0LnBpbmdfc2VydmVyX3Nob3J0ZXN0LFxuICAgICAgICAgICAgdGVzdF9zcGVlZF9kb3dubG9hZDogX3JtYnRUZXN0UmVzdWx0LnNwZWVkX2Rvd25sb2FkLFxuICAgICAgICAgICAgdGVzdF9zcGVlZF91cGxvYWQ6IF9ybWJ0VGVzdFJlc3VsdC5zcGVlZF91cGxvYWQsXG4gICAgICAgICAgICB0ZXN0X3Rva2VuOiByZWdpc3RyYXRpb25SZXNwb25zZS50ZXN0X3Rva2VuLFxuICAgICAgICAgICAgdGVzdF91dWlkOiByZWdpc3RyYXRpb25SZXNwb25zZS50ZXN0X3V1aWQsXG4gICAgICAgICAgICB0aW1lOiBfcm1idFRlc3RSZXN1bHQuYmVnaW5UaW1lLFxuICAgICAgICAgICAgdGltZXpvbmU6IF9ybWJ0VGVzdENvbmZpZy50aW1lem9uZSxcbiAgICAgICAgICAgIHR5cGU6IFwiREVTS1RPUFwiLFxuICAgICAgICAgICAgdmVyc2lvbl9jb2RlOiBcIjFcIixcbiAgICAgICAgICAgIHNwZWVkX2RldGFpbDogX3JtYnRUZXN0UmVzdWx0LnNwZWVkSXRlbXMsXG4gICAgICAgICAgICB1c2VyX3NlcnZlcl9zZWxlY3Rpb246IF9ybWJ0VGVzdENvbmZpZy51c2VyU2VydmVyU2VsZWN0aW9uXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgdGVzdFxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IGVudW0gW0lOSVQsIFBJTkddXG4gICAgICovXG4gICAgdGhpcy5nZXRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFwiSU5JVFwiO1xuICAgIH07XG5cbiAgICBjb25zdHJ1Y3Qocm1idFRlc3RDb25maWcsIHJtYnRDb250cm9sU2VydmVyKTtcbn07XG5cInVzZSBzdHJpY3RcIjtcblxudmFyIGN1ckdlb1BvcyA9IHZvaWQgMDtcbnZhciBnZW9fY2FsbGJhY2sgPSB2b2lkIDAsXG4gICAgbG9jX3RpbWVvdXQgPSB2b2lkIDA7XG5cbmZ1bmN0aW9uIHJ1bkNhbGxiYWNrKCkge1xuICAgIGlmIChnZW9fY2FsbGJhY2sgIT0gdW5kZWZpbmVkICYmIHR5cGVvZiBnZW9fY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZ2VvX2NhbGxiYWNrKCk7XG4gICAgICAgIH0sIDEpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q3VyTG9jYXRpb24oKSB7XG4gICAgcmV0dXJuIGN1ckdlb1Bvcztcbn1cblxuLyoqXG4gKiBHZXRMb2NhdGlvbiwgSlNEb2MgZnJvbSBvbGQgVGVzdFxuICogQHBhcmFtIHtCb29sZWFufSBnZW9BY2N1cmFjeSBlbmFibGUgaGlnaCBhY2N1cmFjeSAoaS5lLiBHUFMgaW5zdGVhZCBvZiBBUClcbiAqIEBwYXJhbSB7TnVtZXJpY30gZ2VvVGltZW91dCBtYXhpbWFsIHRpbWVvdXQgYmVmb3JlIGVycm9yIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICogQHBhcmFtIHtOdW1lcmljfSBnZW9NYXhBZ2UgbWF4aW1hbCBhbGxvd2VkIGFnZSBpbiBtaWxsaXNlY29uZHNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKi9cbmZ1bmN0aW9uIGdldExvY2F0aW9uKGdlb0FjY3VyYWN5LCBnZW9UaW1lb3V0LCBnZW9NYXhBZ2UsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGF1c2dhYmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImluZm9nZW9cIik7XG4gICAgZ2VvX2NhbGxiYWNrID0gY2FsbGJhY2s7XG5cbiAgICBpZiAoIW5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuICAgICAgICAvL21heWJlIHRoZXJlIGlzIGEgcG9zaXRpb24gaW4gYSBjb29raWVcbiAgICAgICAgLy9iZWNhdXNlIHRoZSB1c2VyIGhhZCBiZWVuIGFza2VkIGZvciBoaXMgYWRkcmVzc1xuICAgICAgICB2YXIgY29vcmRzID0gZ2V0Q29va2llKCdjb29yZHMnKTtcbiAgICAgICAgaWYgKGNvb3Jkcykge1xuICAgICAgICAgICAgdmFyIHRtcGNvb3JkcyA9IEpTT04ucGFyc2UoY29vcmRzKTtcbiAgICAgICAgICAgIGlmICh0bXBjb29yZHMgJiYgdG1wY29vcmRzWydsYXQnXSA+IDAgJiYgdG1wY29vcmRzWydsb25nJ10gPiAwKSB7XG4gICAgICAgICAgICAgICAgdGVzdFZpc3VhbGl6YXRpb24uc2V0TG9jYXRpb24odG1wY29vcmRzWydsYXQnXSwgdG1wY29vcmRzWydsb25nJ10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXVzZ2FiZS5pbm5lckhUTUwgPSBMYW5nLmdldFN0cmluZygnTm90U3VwcG9ydGVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICBydW5DYWxsYmFjaygpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHJ1bkNhbGxiYWNrKCk7XG4gICAgLy92YXIgVGVzdEVudmlyb25tZW50LmdldEdlb1RyYWNrZXIoKSA9IG5ldyBHZW9UcmFja2VyKCk7XG4gICAgVGVzdEVudmlyb25tZW50LmdldEdlb1RyYWNrZXIoKS5zdGFydChmdW5jdGlvbiAoc3VjY2Vzc2Z1bCwgZXJyb3IpIHtcbiAgICAgICAgaWYgKHN1Y2Nlc3NmdWwgIT09IHRydWUpIHtcbiAgICAgICAgICAgIC8vdXNlciBkaWQgbm90IGFsbG93IGdlb2xvY2F0aW9uIG9yIG90aGVyIHJlYXNvblxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChlcnJvci5jb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgZXJyb3IuUEVSTUlTU0lPTl9ERU5JRUQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBhdXNnYWJlLmlubmVySFRNTCA9IExhbmcuZ2V0U3RyaW5nKCdOb1Blcm1pc3Npb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIGVycm9yLlRJTUVPVVQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAvL0BUT0RPOiBQb3NpdGlvbiBpcyBkZXRlcm1pbmVkLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2FsZXJ0KDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgZXJyb3IuUE9TSVRJT05fVU5BVkFJTEFCTEU6XG4gICAgICAgICAgICAgICAgICAgICAgICBhdXNnYWJlLmlubmVySFRNTCA9IExhbmcuZ2V0U3RyaW5nKCdOb3RBdmFpbGFibGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIGVycm9yLlVOS05PV05fRVJST1I6XG4gICAgICAgICAgICAgICAgICAgICAgICBhdXNnYWJlLmlubmVySFRNTCA9IExhbmcuZ2V0U3RyaW5nKCdOb3RBdmFpbGFibGUnKSArIFwiKFwiICsgZXJyb3IuY29kZSArIFwiKVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvL0ludGVybmV0IEV4cGxvcmVyIDExIGluIHNvbWUgY2FzZXMgZG9lcyBub3QgcmV0dXJuIGFuIGVycm9yIGNvZGVcbiAgICAgICAgICAgICAgICBhdXNnYWJlLmlubmVySFRNTCA9IExhbmcuZ2V0U3RyaW5nKCdOb3RBdmFpbGFibGUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sIFRlc3RFbnZpcm9ubWVudC5nZXRUZXN0VmlzdWFsaXphdGlvbigpKTtcbn1cblxuLy9HZW9sb2NhdGlvbiB0cmFja2luZ1xudmFyIEdlb1RyYWNrZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgX2Vycm9yVGltZW91dCA9IDJlMzsgLy8yIHNlY29uZHMgZXJyb3IgdGltZW91dFxuICAgIHZhciBfbWF4QWdlID0gNjBlMzsgLy91cCB0byBvbmUgbWludXRlIG9sZCAtIGRvbid0IGRvIGdlb3Bvc2l0aW9uIGFnYWluXG5cbiAgICB2YXIgX3Bvc2l0aW9ucyA9IHZvaWQgMDtcbiAgICB2YXIgX2NsaWVudENhbGxiYWNrID0gdm9pZCAwO1xuICAgIHZhciBfdGVzdFZpc3VhbGl6YXRpb24gPSBudWxsO1xuXG4gICAgdmFyIF93YXRjaGVyID0gdm9pZCAwO1xuICAgIHZhciBfZmlyc3RQb3NpdGlvbklzSW5BY2N1cmF0ZSA9IHZvaWQgMDtcblxuICAgIGZ1bmN0aW9uIEdlb1RyYWNrZXIoKSB7XG4gICAgICAgIF9wb3NpdGlvbnMgPSBbXTtcbiAgICAgICAgX2ZpcnN0UG9zaXRpb25Jc0luQWNjdXJhdGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBnZW9sb2NhdGluZ1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb24oQm9vbGVhbil9IGNhbGxiYWNrIGV4cGVjdHMgcGFyYW0gJ3N1Y2Nlc3NmdWwnIChib29sZWFuLCBFcnJvclJlYXNvbikgYW5kXG4gICAgICogICAgICBpcyBjYWxsZWQgYXMgc29vbiBhcyB0aGVyZSBpcyBhIHJlc3VsdCBhdmFpbGFibGUgb3IgdGhlIHVzZXIgY2FuY2VsbGVkXG4gICAgICogQHBhcmFtIHtUZXN0VmlzdWFsaXphdGlvbn0gdGVzdFZpc3VhbGl6YXRpb24gb3B0aW9uYWxcbiAgICAgKi9cbiAgICBHZW9UcmFja2VyLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uIChjYWxsYmFjaywgdGVzdFZpc3VhbGl6YXRpb24pIHtcbiAgICAgICAgX2NsaWVudENhbGxiYWNrID0gY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKHRlc3RWaXN1YWxpemF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIF90ZXN0VmlzdWFsaXphdGlvbiA9IHRlc3RWaXN1YWxpemF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuICAgICAgICAgICAgLy90cnkgdG8gZ2V0IGFuIHJvdWdoIGZpcnN0IHBvc2l0aW9uXG4gICAgICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9wb3NpdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIF9maXJzdFBvc2l0aW9uSXNJbkFjY3VyYXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0Z1bmN0aW9uKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGVycm9yRnVuY3Rpb24sIHtcbiAgICAgICAgICAgICAgICBlbmFibGVIaWdoQWNjdXJhY3k6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IF9lcnJvclRpbWVvdXQsIC8vMiBzZWNvbmRzXG4gICAgICAgICAgICAgICAgbWF4aW11bUFnZTogX21heEFnZSAvL29uZSBtaW51dGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy9hbmQgcmVmaW5lIHRoaXMgcG9zaXRpb24gbGF0ZXJcbiAgICAgICAgICAgIF93YXRjaGVyID0gbmF2aWdhdG9yLmdlb2xvY2F0aW9uLndhdGNoUG9zaXRpb24oc3VjY2Vzc0Z1bmN0aW9uLCBlcnJvckZ1bmN0aW9uLCB7XG4gICAgICAgICAgICAgICAgZW5hYmxlSGlnaEFjY3VyYWN5OiB0cnVlLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IEluZmluaXR5LFxuICAgICAgICAgICAgICAgIG1heGltdW1BZ2U6IDAgLy9vbmUgbWludXRlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB0ID0gX2NsaWVudENhbGxiYWNrO1xuICAgICAgICAgICAgX2NsaWVudENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgICAgIHQoZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9NaWNyb3NvZnQgRWRnZSBkb2VzIG5vdCBhZGhlcmUgdG8gdGhlIHN0YW5kYXJkLCBhbmQgZG9lcyBub3QgY2FsbCB0aGUgZXJyb3JcbiAgICAgICAgLy9mdW5jdGlvbiBhZnRlciB0aGUgc3BlY2lmaWVkIGNhbGxiYWNrLCBzbyB3ZSBoYXZlIHRvIGNhbGwgaXQgbWFudWFsbHlcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZXJyb3JGdW5jdGlvbigpO1xuICAgICAgICB9LCBfZXJyb3JUaW1lb3V0KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2F2ZXMgdGhlIGdpdmVuIHJlc3VsdFxuICAgICAqIElzIGNhbGxlZCB3aGVuIGEgZ2VvbG9jYXRpb24gcXVlcnkgcmV0dXJucyBhIHJlc3VsdFxuICAgICAqIEBwYXJhbSB7UG9zaXRpb259IHBvc2l0aW9uIHRoZSByZXN1bHQgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1Bvc2l0aW9uXG4gICAgICovXG4gICAgdmFyIHN1Y2Nlc3NGdW5jdGlvbiA9IGZ1bmN0aW9uIHN1Y2Nlc3NGdW5jdGlvbihwb3NpdGlvbikge1xuICAgICAgICAvL3JvdWdoIGZpcnN0IHBvc2l0aW9uIGFuZCBub3cgbW9yZSBhY2N1cmF0ZSBvbmUgLT4gcmVtb3ZlIHRoZSBpbmFjY3VyYXRlIG9uZVxuICAgICAgICBpZiAoX3Bvc2l0aW9ucy5sZW5ndGggPT09IDEgJiYgX2ZpcnN0UG9zaXRpb25Jc0luQWNjdXJhdGUpIHtcbiAgICAgICAgICAgIF9wb3NpdGlvbnMgPSBbXTtcbiAgICAgICAgICAgIF9maXJzdFBvc2l0aW9uSXNJbkFjY3VyYXRlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBfcG9zaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgZ2VvX2xhdDogcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlLFxuICAgICAgICAgICAgZ2VvX2xvbmc6IHBvc2l0aW9uLmNvb3Jkcy5sb25naXR1ZGUsXG4gICAgICAgICAgICBhY2N1cmFjeTogcG9zaXRpb24uY29vcmRzLmFjY3VyYWN5LFxuICAgICAgICAgICAgYWx0aXR1ZGU6IHBvc2l0aW9uLmNvb3Jkcy5hbHRpdHVkZSxcbiAgICAgICAgICAgIGJlYXJpbmc6IHBvc2l0aW9uLmNvb3Jkcy5oZWFkaW5nLFxuICAgICAgICAgICAgc3BlZWQ6IHBvc2l0aW9uLmNvb3Jkcy5zcGVlZCxcbiAgICAgICAgICAgIHRzdGFtcDogcG9zaXRpb24udGltZXN0YW1wLFxuICAgICAgICAgICAgcHJvdmlkZXI6ICdCcm93c2VyJ1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKF9jbGllbnRDYWxsYmFjayAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy9jYWxsIGNsaWVudCB0aGF0IHdlIG5vdyBoYXZlIGEgcmVzdWx0XG4gICAgICAgICAgICB2YXIgdCA9IF9jbGllbnRDYWxsYmFjaztcbiAgICAgICAgICAgIF9jbGllbnRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgICAgICB0KHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfdGVzdFZpc3VhbGl6YXRpb24gIT09IG51bGwpIHtcbiAgICAgICAgICAgIF90ZXN0VmlzdWFsaXphdGlvbi5zZXRMb2NhdGlvbihwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGUsIHBvc2l0aW9uLmNvb3Jkcy5sb25naXR1ZGUpO1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUNvb2tpZShwb3NpdGlvbik7XG4gICAgfTtcblxuICAgIHZhciBlcnJvckZ1bmN0aW9uID0gZnVuY3Rpb24gZXJyb3JGdW5jdGlvbihyZWFzb24pIHtcbiAgICAgICAgLy9Qb3NpdGlvbkVycm9yIE9iamVjdCAoaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1Bvc2l0aW9uRXJyb3IpXG4gICAgICAgIGlmIChfY2xpZW50Q2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vY2FsbCBjbGllbnQgdGhhdCB3ZSBub3cgaGF2ZSBhbiBlcnJvclxuICAgICAgICAgICAgdmFyIHQgPSBfY2xpZW50Q2FsbGJhY2s7XG4gICAgICAgICAgICBfY2xpZW50Q2FsbGJhY2sgPSBudWxsO1xuICAgICAgICAgICAgdChmYWxzZSwgcmVhc29uKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgdXBkYXRlQ29va2llID0gZnVuY3Rpb24gdXBkYXRlQ29va2llKHBvc2l0aW9uKSB7XG4gICAgICAgIHZhciBjb29yZHMgPSB7fTtcbiAgICAgICAgY29vcmRzWydsYXQnXSA9IHBvc2l0aW9uLmNvb3Jkcy5sYXRpdHVkZTtcbiAgICAgICAgY29vcmRzWydsb25nJ10gPSBwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlO1xuICAgICAgICBjb29yZHNbJ2FjY3VyYWN5J10gPSBwb3NpdGlvbi5jb29yZHMuYWNjdXJhY3k7XG4gICAgICAgIGNvb3Jkc1snYWx0aXR1ZGUnXSA9IHBvc2l0aW9uLmNvb3Jkcy5hbHRpdHVkZTtcbiAgICAgICAgY29vcmRzWydoZWFkaW5nJ10gPSBwb3NpdGlvbi5jb29yZHMuaGVhZGluZztcbiAgICAgICAgY29vcmRzWydzcGVlZCddID0gcG9zaXRpb24uY29vcmRzLnNwZWVkO1xuICAgICAgICBjb29yZHNbJ3RzdGFtcCddID0gcG9zaXRpb24udGltZXN0YW1wO1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiY29vcmRzOiBcIitjb29yZHMpO1xuICAgICAgICBjb29yZHMgPSBKU09OLnN0cmluZ2lmeShjb29yZHMpO1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwidG1wY29vcmRzOiBcIit0bXBjb29yZHMpO1xuICAgICAgICBzZXRDb29raWUoJ2Nvb3JkcycsIGNvb3JkcywgMzYwMCk7XG4gICAgfTtcblxuICAgIEdlb1RyYWNrZXIucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChuYXZpZ2F0b3IuZ2VvbG9jYXRpb24pIHtcbiAgICAgICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5jbGVhcldhdGNoKF93YXRjaGVyKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gYWxsIHJlc3VsdHNcbiAgICAgKi9cbiAgICBHZW9UcmFja2VyLnByb3RvdHlwZS5nZXRSZXN1bHRzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvL2ZpbHRlciBkdXBsaWNhdGUgcmVzdWx0cyB0aGF0IGNhbiBvY2N1ciB3aGVuIHVzaW5nIGhhcmR3YXJlIEdQUyBkZXZpY2VzXG4gICAgICAgIC8vd2l0aCBjZXJ0YWluIEJyb3dzZXJzXG4gICAgICAgIHZhciBwcmV2aW91c0l0ZW0gPSBudWxsO1xuICAgICAgICBfcG9zaXRpb25zID0gX3Bvc2l0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICBpZiAocHJldmlvdXNJdGVtID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwcmV2aW91c0l0ZW0gPSBwb3NpdGlvbjtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBlcXVhbCA9IE9iamVjdC5rZXlzKHBvc2l0aW9uKS5ldmVyeShmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZXZpb3VzSXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHByZXZpb3VzSXRlbVtrZXldID09PSBwb3NpdGlvbltrZXldO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXF1YWwpIHtcbiAgICAgICAgICAgICAgICAvL3JlbW92ZSB0aGlzIGl0ZW1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHByZXZpb3VzSXRlbSA9IHBvc2l0aW9uO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gX3Bvc2l0aW9ucztcbiAgICB9O1xuXG4gICAgcmV0dXJuIEdlb1RyYWNrZXI7XG59KCk7XG5cbi8qIGdldENvb2tpZSBwb2x5ZmlsbCAqL1xuaWYgKHR5cGVvZiB3aW5kb3cuc2V0Q29va2llID09PSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5zZXRDb29raWUgPSBmdW5jdGlvbiAoY29va2llX25hbWUsIGNvb2tpZV92YWx1ZSwgY29va2llX2V4c2Vjb25kcykge1xuICAgICAgICAvL3ZhciBleGRhdGUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAvL2V4ZGF0ZS5zZXREYXRlKGV4ZGF0ZS5nZXREYXRlKCkgKyBjb29raWVfZXhkYXlzKTtcblxuICAgICAgICB2YXIgZnV0dXJlZGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIHZhciBleHBkYXRlID0gZnV0dXJlZGF0ZS5nZXRUaW1lKCk7XG4gICAgICAgIGV4cGRhdGUgKz0gY29va2llX2V4c2Vjb25kcyAqIDEwMDA7XG4gICAgICAgIGZ1dHVyZWRhdGUuc2V0VGltZShleHBkYXRlKTtcblxuICAgICAgICAvL3ZhciBjX3ZhbHVlPWVzY2FwZShjb29raWVfdmFsdWUpICsgKChjb29raWVfZXhkYXlzPT1udWxsKSA/IFwiO1wiIDogXCI7IGV4cGlyZXM9XCIrZXhkYXRlLnRvVVRDU3RyaW5nKCkgK1wiO1wiKTtcbiAgICAgICAgdmFyIGNfdmFsdWUgPSBlbmNvZGVVUklDb21wb25lbnQoY29va2llX3ZhbHVlKSArIChjb29raWVfZXhzZWNvbmRzID09IG51bGwgPyBcIjtcIiA6IFwiOyBleHBpcmVzPVwiICsgZnV0dXJlZGF0ZS50b1VUQ1N0cmluZygpICsgXCI7XCIpO1xuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjb29raWVfbmFtZSArIFwiPVwiICsgY192YWx1ZSArIFwiIHBhdGg9LztcIjtcbiAgICB9O1xufVxuJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG4vKipcbiAqIEhhbmRsZXMgdGhlIGNvbW11bmljYXRpb24gd2l0aCB0aGUgQ29udHJvbFNlcnZlclxuICogQHBhcmFtIHJtYnRUZXN0Q29uZmlnIFJNQlQgVGVzdCBDb25maWd1cmF0aW9cbiAqIEBwYXJhbSBvcHRpb25zIGFkZGl0aW9uYWwgb3B0aW9uczpcbiAqICAncmVnaXN0ZXInOiBGdW5jdGlvbiB0byBiZSBjYWxsZWQgYWZ0ZXIgcmVnaXN0cmF0aW9uOiBmdW5jdGlvbihldmVudClcbiAqICAnc3VibWl0JzogIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhZnRlciByZXN1bHQgc3VibWlzc2lvbjogZnVuY3Rpb24oZXZlbnQpXG4gKiBAcmV0dXJucyBPYmplY3RcbiAqL1xudmFyIFJNQlRDb250cm9sU2VydmVyQ29tbXVuaWNhdGlvbiA9IGV4cG9ydHMuUk1CVENvbnRyb2xTZXJ2ZXJDb21tdW5pY2F0aW9uID0gZnVuY3Rpb24gUk1CVENvbnRyb2xTZXJ2ZXJDb21tdW5pY2F0aW9uKHJtYnRUZXN0Q29uZmlnLCBvcHRpb25zKSB7XG4gICAgdmFyIF9ybWJ0VGVzdENvbmZpZyA9IHJtYnRUZXN0Q29uZmlnO1xuICAgIHZhciBfbG9nZ2VyID0gbG9nLmdldExvZ2dlcihcInJtYnR3c1wiKTtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBoZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIHx8IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlQ2FsbGJhY2t9IG9uc3VjY2VzcyBjYWxsZWQgb24gY29tcGxldGlvblxuICAgICAgICAgKi9cbiAgICAgICAgb2J0YWluQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvbjogZnVuY3Rpb24gb2J0YWluQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvbihvbnN1Y2Nlc3MsIG9uZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBqc29uX2RhdGEgPSB7XG4gICAgICAgICAgICAgICAgdmVyc2lvbjogX3JtYnRUZXN0Q29uZmlnLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2U6IF9ybWJ0VGVzdENvbmZpZy5sYW5ndWFnZSxcbiAgICAgICAgICAgICAgICB1dWlkOiBfcm1idFRlc3RDb25maWcudXVpZCxcbiAgICAgICAgICAgICAgICB0eXBlOiBfcm1idFRlc3RDb25maWcudHlwZSxcbiAgICAgICAgICAgICAgICB2ZXJzaW9uX2NvZGU6IF9ybWJ0VGVzdENvbmZpZy52ZXJzaW9uX2NvZGUsXG4gICAgICAgICAgICAgICAgY2xpZW50OiBfcm1idFRlc3RDb25maWcuY2xpZW50LFxuICAgICAgICAgICAgICAgIHRpbWV6b25lOiBfcm1idFRlc3RDb25maWcudGltZXpvbmUsXG4gICAgICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vYWRkIGFkZGl0aW9uYWwgcGFyYW1ldGVycyBmcm9tIHRoZSBjb25maWd1cmF0aW9uLCBpZiBhbnlcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oanNvbl9kYXRhLCBfcm1idFRlc3RDb25maWcuYWRkaXRpb25hbFJlZ2lzdHJhdGlvblBhcmFtZXRlcnMpO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHVzZXJTZXJ2ZXJTZWxlY3Rpb24gIT09IFwidW5kZWZpbmVkXCIgJiYgdXNlclNlcnZlclNlbGVjdGlvbiA+IDAgJiYgdHlwZW9mIFVzZXJDb25mICE9PSBcInVuZGVmaW5lZFwiICYmIFVzZXJDb25mLnByZWZlcnJlZFNlcnZlciAhPT0gdW5kZWZpbmVkICYmIFVzZXJDb25mLnByZWZlcnJlZFNlcnZlciAhPT0gXCJkZWZhdWx0XCIpIHtcbiAgICAgICAgICAgICAgICBqc29uX2RhdGFbJ3ByZWZlcl9zZXJ2ZXInXSA9IFVzZXJDb25mLnByZWZlcnJlZFNlcnZlcjtcbiAgICAgICAgICAgICAgICBqc29uX2RhdGFbJ3VzZXJfc2VydmVyX3NlbGVjdGlvbiddID0gdXNlclNlcnZlclNlbGVjdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gdm9pZCAwO1xuICAgICAgICAgICAgZmV0Y2goX3JtYnRUZXN0Q29uZmlnLmNvbnRyb2xTZXJ2ZXJVUkwgKyBfcm1idFRlc3RDb25maWcuY29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc291cmNlLCB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShqc29uX2RhdGEpXG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oKTtcbiAgICAgICAgICAgIH0pLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IG5ldyBSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlKGRhdGEpO1xuICAgICAgICAgICAgICAgIG9uc3VjY2Vzcyhjb25maWcpO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gcmVhc29uO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZXJyb3IoXCJlcnJvciBnZXR0aW5nIHRlc3RJRFwiKTtcbiAgICAgICAgICAgICAgICBvbmVycm9yKCk7XG4gICAgICAgICAgICB9KS5maW5hbGx5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoX3JlZ2lzdHJhdGlvbkNhbGxiYWNrICE9IG51bGwgJiYgdHlwZW9mIF9yZWdpc3RyYXRpb25DYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBfcmVnaXN0cmF0aW9uQ2FsbGJhY2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdDoganNvbl9kYXRhXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgXCJkYXRhIGNvbGxlY3RvclwiIG1ldGFkYXRhIChsaWtlIGJyb3dzZXIgZmFtaWx5KSBhbmQgdXBkYXRlIGNvbmZpZ1xuICAgICAgICAgKlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0RGF0YUNvbGxlY3RvckluZm86IGZ1bmN0aW9uIGdldERhdGFDb2xsZWN0b3JJbmZvKCkge1xuICAgICAgICAgICAgZmV0Y2goX3JtYnRUZXN0Q29uZmlnLmNvbnRyb2xTZXJ2ZXJVUkwgKyBfcm1idFRlc3RDb25maWcuY29udHJvbFNlcnZlckRhdGFDb2xsZWN0b3JSZXNvdXJjZSwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICAgICAgaGVhZGVyczogaGVhZGVyc1xuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgX3JtYnRUZXN0Q29uZmlnLnByb2R1Y3QgPSBkYXRhLmFnZW50LnN1YnN0cmluZygwLCBNYXRoLm1pbigxNTAsIGRhdGEuYWdlbnQubGVuZ3RoKSk7XG4gICAgICAgICAgICAgICAgX3JtYnRUZXN0Q29uZmlnLm1vZGVsID0gZGF0YS5wcm9kdWN0O1xuICAgICAgICAgICAgICAgIF9ybWJ0VGVzdENvbmZpZy5vc192ZXJzaW9uID0gZGF0YS52ZXJzaW9uO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZXJyb3IoXCJlcnJvciBnZXR0aW5nIGRhdGEgY29sbGVjdGlvbiByZXNwb25zZVwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiAgUG9zdCB0ZXN0IHJlc3VsdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gIGpzb25fZGF0YSBEYXRhIHRvIGJlIHNlbnQgdG8gc2VydmVyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICAgICAqL1xuICAgICAgICBzdWJtaXRSZXN1bHRzOiBmdW5jdGlvbiBzdWJtaXRSZXN1bHRzKGpzb25fZGF0YSwgb25zdWNjZXNzLCBvbmVycm9yKSB7XG4gICAgICAgICAgICAvL2FkZCBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgZnJvbSB0aGUgY29uZmlndXJhdGlvbiwgaWYgYW55XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGpzb25fZGF0YSwgX3JtYnRUZXN0Q29uZmlnLmFkZGl0aW9uYWxTdWJtaXNzaW9uUGFyYW1ldGVycyk7XG5cbiAgICAgICAgICAgIHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkoanNvbl9kYXRhKTtcbiAgICAgICAgICAgIF9sb2dnZXIuZGVidWcoXCJTdWJtaXQgc2l6ZTogXCIgKyBqc29uLmxlbmd0aCk7XG5cbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IHZvaWQgMDtcbiAgICAgICAgICAgIGZldGNoKF9ybWJ0VGVzdENvbmZpZy5jb250cm9sU2VydmVyVVJMICsgX3JtYnRUZXN0Q29uZmlnLmNvbnRyb2xTZXJ2ZXJSZXN1bHRSZXNvdXJjZSwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgYm9keToganNvblxuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSBkYXRhO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcoanNvbl9kYXRhLnRlc3RfdXVpZCk7XG4gICAgICAgICAgICAgICAgb25zdWNjZXNzKHRydWUpO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gcmVhc29uO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZXJyb3IoXCJlcnJvciBzdWJtaXR0aW5nIHJlc3VsdHNcIik7XG4gICAgICAgICAgICAgICAgb25lcnJvcihmYWxzZSk7XG4gICAgICAgICAgICB9KS5maW5hbGx5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoX3N1Ym1pc3Npb25DYWxsYmFjayAhPT0gbnVsbCAmJiB0eXBlb2YgX3N1Ym1pc3Npb25DYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBfc3VibWlzc2lvbkNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3Q6IGpzb25fZGF0YVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbnZhciBUZXN0RW52aXJvbm1lbnQgPSBleHBvcnRzLlRlc3RFbnZpcm9ubWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGVzdFZpc3VhbGl6YXRpb24gPSBudWxsO1xuICAgIHZhciBnZW9UcmFja2VyID0gbnVsbDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXRzIHRoZSBUZXN0VmlzdWFsaXphdGlvbiBvciBudWxsXG4gICAgICAgICAqIEByZXR1cm5zIHtUZXN0VmlzdWFsaXphdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGdldFRlc3RWaXN1YWxpemF0aW9uOiBmdW5jdGlvbiBnZXRUZXN0VmlzdWFsaXphdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZXN0VmlzdWFsaXphdGlvbjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0cyB0aGUgR2VvVHJhY2tlciBvciBudWxsXG4gICAgICAgICAqIEByZXR1cm5zIHtHZW9UcmFja2VyfVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0R2VvVHJhY2tlcjogZnVuY3Rpb24gZ2V0R2VvVHJhY2tlcigpIHtcbiAgICAgICAgICAgIHJldHVybiBnZW9UcmFja2VyO1xuICAgICAgICB9LFxuXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIGluaXQodFZpc3VhbGl6YXRpb24sIGdUcmFja2VyKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRWaXN1YWxpemF0aW9uID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRWaXN1YWxpemF0aW9uID0gbmV3IFRlc3RWaXN1YWxpemF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIGdUcmFja2VyID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGdUcmFja2VyID0gbmV3IEdlb1RyYWNrZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRlc3RWaXN1YWxpemF0aW9uID0gdFZpc3VhbGl6YXRpb247XG4gICAgICAgICAgICBnZW9UcmFja2VyID0gZ1RyYWNrZXI7XG4gICAgICAgIH1cbiAgICB9O1xufSgpO1xuXG4vL1N0YXRlc1xudmFyIFRlc3RTdGF0ZSA9IHtcbiAgICBXQUlUOiBcIldBSVRcIixcbiAgICBJTklUOiBcIklOSVRcIixcbiAgICBJTklUX0RPV046IFwiSU5JVF9ET1dOXCIsXG4gICAgUElORzogXCJQSU5HXCIsXG4gICAgRE9XTjogXCJET1dOXCIsXG4gICAgQ09OTkVDVF9VUExPQUQ6IFwiQ09OTkVDVF9VUExPQURcIixcbiAgICBJTklUX1VQOiBcIklOSVRfVVBcIixcbiAgICBVUDogXCJVUFwiLFxuICAgIEVORDogXCJFTkRcIixcbiAgICBFUlJPUjogXCJFUlJPUlwiLFxuICAgIEFCT1JURUQ6IFwiQUJPUlRFRFwiLFxuICAgIExPQ0FURTogXCJMT0NBVEVcIixcbiAgICBMT0NBQk9SVEVEOiBcIkxPQ0FCT1JURURcIixcbiAgICBTUEVFRFRFU1RfRU5EOiBcIlNQRUVEVEVTVF9FTkRcIixcbiAgICBRT1NfVEVTVF9SVU5OSU5HOiBcIlFPU19URVNUX1JVTk5JTkdcIixcbiAgICBRT1NfRU5EOiBcIlFPU19FTkRcIlxufTtcblxuLy9JbnRlcm1lZGlhdGUgUmVzdWx0XG5mdW5jdGlvbiBSTUJUSW50ZXJtZWRpYXRlUmVzdWx0KCkge31cblJNQlRJbnRlcm1lZGlhdGVSZXN1bHQucHJvdG90eXBlLnNldExvZ1ZhbHVlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdG9Mb2cgPSBmdW5jdGlvbiB0b0xvZyh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPCAxMDAwMCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICgyLjAgKyBNYXRoLmxvZyh2YWx1ZSAvIDFlNiAvIE1hdGguTE4xMCkpIC8gNC4wO1xuICAgIH07XG4gICAgdGhpcy5kb3duQml0UGVyU2VjTG9nID0gdG9Mb2coZG93bkJpdFBlclNlYyk7XG4gICAgdGhpcy51cEJpdFBlclNlY0xvZyA9IHRvTG9nKHVwQml0UGVyU2VjKTtcbn07XG5cblJNQlRJbnRlcm1lZGlhdGVSZXN1bHQucHJvdG90eXBlLnBpbmdOYW5vID0gLTE7XG5STUJUSW50ZXJtZWRpYXRlUmVzdWx0LnByb3RvdHlwZS5kb3duQml0UGVyU2VjID0gLTE7XG5STUJUSW50ZXJtZWRpYXRlUmVzdWx0LnByb3RvdHlwZS51cEJpdFBlclNlYyA9IC0xO1xuUk1CVEludGVybWVkaWF0ZVJlc3VsdC5wcm90b3R5cGUuc3RhdHVzID0gVGVzdFN0YXRlLklOSVQ7XG5STUJUSW50ZXJtZWRpYXRlUmVzdWx0LnByb3RvdHlwZS5wcm9ncmVzcyA9IDA7XG5STUJUSW50ZXJtZWRpYXRlUmVzdWx0LnByb3RvdHlwZS5kb3duQml0UGVyU2VjTG9nID0gLTE7XG5STUJUSW50ZXJtZWRpYXRlUmVzdWx0LnByb3RvdHlwZS51cEJpdFBlclNlY0xvZyA9IC0xO1xuUk1CVEludGVybWVkaWF0ZVJlc3VsdC5wcm90b3R5cGUucmVtYWluaW5nV2FpdCA9IC0xO1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogQWJvdXQgVGVzdFZpc3VhbGl6YXRpb246XG4gKiAgc2V0Uk1CVFRlc3QgZXhwZWN0cyBhIG9iamVjdCB0aGF0IGltcGxlbWVudHMge1JNQlRJbnRlcm1lZGlhdGVSZXN1bHR9LmdldEludGVybWVkaWF0ZVJlc3VsdCgpXG4gKiAgICAgIHRoaXMgd2lsbCBiZSBjYWxsZWQgZXZlcnkgeHggbXMgKHB1bGwpXG4gKiAgVGhlIEFuaW1hdGlvbiBsb29wIHdpbGwgc3RhcnQgYXMgc29vbiBhcyBcInN0YXJ0VGVzdCgpXCIgaXMgY2FsbGVkXG4gKiAgVGhlIHN0YXR1cyBjYW4gYmUgc2V0IGRpcmVjdGx5IHZpYSBzZXRTdGF0dXMgb3IgaW4gdGhlIGludGVybWVkaWF0ZVJlc3VsdFxuICogIEluZm9ybWF0aW9uIChwcm92aWRlciwgaXAsIHV1aWQsIGV0Yy4pIGhhcyB0byBiZSBzZXQgdmlhIHVwZGF0ZUluZm9ybWF0aW9uXG4gKiAgQXMgc29vbiBhcyB0aGUgdGVzdCByZWFjaGVzIHRoZSBcIkVuZFwiLVN0YXRlLCB0aGUgcmVzdWx0IHBhZ2UgaXMgY2FsbGVkXG4gKi9cblxudmFyIFRlc3RWaXN1YWxpemF0aW9uID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gVGVzdFZpc3VhbGl6YXRpb24oc3VjY2Vzc0NhbGxiYWNrLCBlcnJvckNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuc3VjY2Vzc0NhbGxiYWNrID0gc3VjY2Vzc0NhbGxiYWNrO1xuICAgICAgICB0aGlzLmVycm9yQ2FsbGJhY2sgPSBlcnJvckNhbGxiYWNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIFJNQlQgVGVzdCBvYmplY3RcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcm1idFRlc3QgaGFzIHRvIHN1cHBvcnQge1JNQlRJbnRlcm1lZGlhdGVSZXN1bHR9LmdldEludGVybWVkaWF0ZVJlc3VsdFxuICAgICAqL1xuICAgIFRlc3RWaXN1YWxpemF0aW9uLnByb3RvdHlwZS5zZXRSTUJUVGVzdCA9IGZ1bmN0aW9uIChybWJ0VGVzdCkge307XG5cbiAgICAvKipcbiAgICAgKiBXaWxsIGJlIGNhbGxlZCBmcm9tIFdlYnNvY2tldHRlc3QgYXMgc29vbiBhcyB0aGlzIGluZm9ybWF0aW9uIGlzIGF2YWlsYWJsZVxuICAgICAqIEBwYXJhbSBzZXJ2ZXJOYW1lXG4gICAgICogQHBhcmFtIHJlbW90ZUlwXG4gICAgICogQHBhcmFtIHByb3ZpZGVyTmFtZVxuICAgICAqIEBwYXJhbSB0ZXN0VVVJRFxuICAgICAqL1xuICAgIFRlc3RWaXN1YWxpemF0aW9uLnByb3RvdHlwZS51cGRhdGVJbmZvID0gZnVuY3Rpb24gKHNlcnZlck5hbWUsIHJlbW90ZUlwLCBwcm92aWRlck5hbWUsIHRlc3RVVUlELCBvcGVuVGVzdFVVSUQpIHt9O1xuXG4gICAgLyoqXG4gICAgICogV2lsbCBiZSBjYWxsZWQgZnJvbSBXZWJzb2NrZXR0ZXN0IGFzIHNvb24gYXMgdGhlIGN1cnJlbnQgc3RhdHVzIGNoYW5nZXNcbiAgICAgKiBAcGFyYW0gc3RhdHVzXG4gICAgICovXG4gICAgVGVzdFZpc3VhbGl6YXRpb24ucHJvdG90eXBlLnNldFN0YXR1cyA9IGZ1bmN0aW9uIChzdGF0dXMpIHtcbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gXCJFUlJPUlwiIHx8IHN0YXR1cyA9PT0gXCJBQk9SVEVEXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVycm9yQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgdCA9IHRoaXMuZXJyb3JDYWxsYmFjaztcbiAgICAgICAgICAgICAgICB0aGlzLmVycm9yQ2FsbGJhY2sgPSBudWxsO1xuICAgICAgICAgICAgICAgIHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzdGF0dXMgPT09IFwiRU5EXCIpIHtcbiAgICAgICAgICAgIC8vIGNhbGwgY2FsbGJhY2sgdGhhdCB0aGUgdGVzdCBpcyBmaW5pc2hlZFxuICAgICAgICAgICAgaWYgKF9zdWNjZXNzQ2FsbGJhY2sgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YXIgdCA9IHRoaXMuc3VjY2Vzc0NhbGxiYWNrO1xuICAgICAgICAgICAgICAgIHRoaXMuc3VjY2Vzc0NhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogV2lsbCBiZSBjYWxsZWQgZnJvbSBHZW9UcmFja2VyIGFzIHNvb24gYXMgYSBsb2NhdGlvbiBpcyBhdmFpbGFibGVcbiAgICAgKiBAcGFyYW0gbGF0aXR1ZGVcbiAgICAgKiBAcGFyYW0gbG9uZ2l0dWRlXG4gICAgICovXG4gICAgVGVzdFZpc3VhbGl6YXRpb24ucHJvdG90eXBlLnNldExvY2F0aW9uID0gZnVuY3Rpb24gKGxhdGl0dWRlLCBsb25naXR1ZGUpIHt9O1xuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIHZpc3VhbGl6YXRpb25cbiAgICAgKi9cbiAgICBUZXN0VmlzdWFsaXphdGlvbi5wcm90b3R5cGUuc3RhcnRUZXN0ID0gZnVuY3Rpb24gKCkge307XG5cbiAgICByZXR1cm4gVGVzdFZpc3VhbGl6YXRpb247XG59KCk7XG5cInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xudmFyIFJNQlRUZXN0Q29uZmlnID0gZXhwb3J0cy5STUJUVGVzdENvbmZpZyA9IGZ1bmN0aW9uICgpIHtcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUudmVyc2lvbiA9IFwiMC4zXCI7IC8vbWluaW1hbCB2ZXJzaW9uIGNvbXBhdGlibGUgd2l0aCB0aGUgdGVzdFxuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5sYW5ndWFnZTtcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUudXVpZCA9IFwiXCI7XG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLnR5cGUgPSBcIkRFU0tUT1BcIjtcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUudmVyc2lvbl9jb2RlID0gXCIwLjNcIjsgLy9taW5pbWFsIHZlcnNpb24gY29tcGF0aWJsZSB3aXRoIHRoZSB0ZXN0XG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLmNsaWVudF92ZXJzaW9uID0gXCIwLjNcIjsgLy9maWxsZWQgb3V0IGJ5IHZlcnNpb24gaW5mb3JtYXRpb24gZnJvbSBSTUJUU2VydmVyXG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLmNsaWVudF9zb2Z0d2FyZV92ZXJzaW9uID0gXCIwLjkuMVwiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5vc192ZXJzaW9uID0gMTtcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUucGxhdGZvcm0gPSBcIlJNQlR3c1wiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5tb2RlbCA9IFwiV2Vic29ja2V0XCI7XG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLnByb2R1Y3QgPSBcIkNocm9tZVwiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5jbGllbnQgPSBcIlJNQlR3c1wiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS50aW1lem9uZSA9IFwiRXVyb3BlL1ZpZW5uYVwiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5jb250cm9sU2VydmVyVVJMO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5jb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzb3VyY2UgPSBcIi90ZXN0UmVxdWVzdFwiO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5jb250cm9sU2VydmVyUmVzdWx0UmVzb3VyY2UgPSBcIi9yZXN1bHRcIjtcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUuY29udHJvbFNlcnZlckRhdGFDb2xsZWN0b3JSZXNvdXJjZSA9IFwiL3JlcXVlc3REYXRhQ29sbGVjdG9yXCI7XG4gICAgLy8/IT8gLSBmcm9tIFJNQlRUZXN0UGFyYW1ldGVyLmphdmFcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUucHJldGVzdER1cmF0aW9uTXMgPSAyMDAwO1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5zYXZlZENodW5rcyA9IDQ7IC8vNCo0ICsgNCo4ICsgNCoxNiArIC4uLiArIDQqTUFYX0NIVU5LX1NJWkUgLT4gTyg4Kk1BWF9DSFVOS19TSVpFKVxuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5tZWFzdXJlbWVudFBvaW50c1RpbWVzcGFuID0gNDA7IC8vMSBtZWFzdXJlIHBvaW50IGV2ZXJ5IDQwIG1zXG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLm51bVBpbmdzID0gMTA7IC8vZG8gMTAgcGluZ3NcbiAgICBSTUJUVGVzdENvbmZpZy5wcm90b3R5cGUuZG9QaW5nSW50ZXJ2YWxNaWxsaXNlY29uZHMgPSAtMTsgLy9pZiBlbmFibGVkLCBwaW5nIHRlc3RzIHdpbGwgYmUgY29uZHVjdGVkIHVudGlsIHRoZSB0aW1lIGxpbWl0IGlzIHJlYWNoZWQgKG1pbiBudW1QaW5ncylcbiAgICAvL21heCB1c2VkIHRocmVhZHMgZm9yIHRoaXMgdGVzdCBwaGFzZSAodXBwZXIgbGltaXQ6IFJlZ2lzdHJhdGlvblJlc3BvbnNlKVxuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS5kb3dubG9hZFRocmVhZHNMaW1pdHNNYml0ID0ge1xuICAgICAgICAwOiAxLFxuICAgICAgICAxOiAzLFxuICAgICAgICAxMDA6IDVcbiAgICB9O1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS51cGxvYWRUaHJlYWRzTGltaXRzTWJpdCA9IHtcbiAgICAgICAgMDogMSxcbiAgICAgICAgMzA6IDIsXG4gICAgICAgIDgwOiAzLFxuICAgICAgICAxNTA6IDVcbiAgICB9O1xuICAgIFJNQlRUZXN0Q29uZmlnLnByb3RvdHlwZS51c2VyU2VydmVyU2VsZWN0aW9uID0gdHlwZW9mIHdpbmRvdy51c2VyU2VydmVyU2VsZWN0aW9uICE9PSAndW5kZWZpbmVkJyA/IHVzZXJTZXJ2ZXJTZWxlY3Rpb24gOiAwOyAvL2ZvciBRb1NUZXN0XG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLmFkZGl0aW9uYWxSZWdpc3RyYXRpb25QYXJhbWV0ZXJzID0ge307IC8vd2lsbCBiZSB0cmFuc21pdHRlZCBpbiBDb250cm9sU2VydmVyIHJlZ2lzdHJhdGlvbiwgaWYgYW55XG4gICAgUk1CVFRlc3RDb25maWcucHJvdG90eXBlLmFkZGl0aW9uYWxTdWJtaXNzaW9uUGFyYW1ldGVycyA9IHt9OyAvL3dpbGwgYmUgdHJhbnNtaXR0ZWQgaW4gQ29udHJvbFNlcnZlciByZXN1bHQgc3VibWlzc2lvbiwgaWYgYW55XG5cbiAgICBmdW5jdGlvbiBSTUJUVGVzdENvbmZpZyhsYW5ndWFnZSwgY29udHJvbFByb3h5LCB3c1BhdGgpIHtcbiAgICAgICAgdGhpcy5sYW5ndWFnZSA9IGxhbmd1YWdlO1xuICAgICAgICB0aGlzLmNvbnRyb2xTZXJ2ZXJVUkwgPSBjb250cm9sUHJveHkgKyBcIi9cIiArIHdzUGF0aDtcblxuICAgICAgICBpZiAodHlwZW9mIEludGwgIT09ICd1bmRlZmluZWQnICYmIEludGwuRGF0ZVRpbWVGb3JtYXQoKS5yZXNvbHZlZE9wdGlvbnMoKS50aW1lWm9uZSkge1xuICAgICAgICAgICAgLy93ZSBhcmUgYmFzZWQgaW4gVmllbm5hIDotKVxuICAgICAgICAgICAgdGhpcy50aW1lem9uZSA9IEludGwuRGF0ZVRpbWVGb3JtYXQoKS5yZXNvbHZlZE9wdGlvbnMoKS50aW1lWm9uZS5yZXBsYWNlKFwiRXVyb3BlL0JlcmxpblwiLCBcIkV1cm9wZS9WaWVubmFcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gUk1CVFRlc3RDb25maWc7XG59KCk7XG5cbnZhciBSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlID0gZnVuY3Rpb24gKCkge1xuICAgIFJNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2UucHJvdG90eXBlLmNsaWVudF9yZW1vdGVfaXA7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUucHJvdmlkZXI7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUudGVzdF9zZXJ2ZXJfZW5jcnlwdGlvbiA9IFwiXCI7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUudGVzdF9udW10aHJlYWRzO1xuICAgIFJNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2UucHJvdG90eXBlLnRlc3Rfc2VydmVyX25hbWU7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUudGVzdF91dWlkO1xuICAgIFJNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2UucHJvdG90eXBlLnRlc3RfaWQ7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUudGVzdF90b2tlbjtcbiAgICBSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlLnByb3RvdHlwZS50ZXN0X3NlcnZlcl9hZGRyZXNzO1xuICAgIFJNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2UucHJvdG90eXBlLnRlc3RfZHVyYXRpb247XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUucmVzdWx0X3VybDtcbiAgICBSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlLnByb3RvdHlwZS50ZXN0X3dhaXQ7XG4gICAgUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZS5wcm90b3R5cGUudGVzdF9zZXJ2ZXJfcG9ydDtcbiAgICAvL3Rlc3RcbiAgICBmdW5jdGlvbiBSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlKGRhdGEpIHtcbiAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCBkYXRhKTtcbiAgICAgICAgdGhpcy50ZXN0X2R1cmF0aW9uID0gcGFyc2VJbnQoZGF0YS50ZXN0X2R1cmF0aW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUk1CVENvbnRyb2xTZXJ2ZXJSZWdpc3RyYXRpb25SZXNwb25zZTtcbn0oKTtcblxuLyoqXG4gKiBDb250cm9sIHN0cnVjdHVyZSBmb3IgYSBzaW5nbGUgd2Vic29ja2V0LXRlc3QgdGhyZWFkXG4gKiBAcGFyYW0ge0N5Y2xpY0JhcnJpZXJ9IGN5Y2xpY0JhcnJpZXJcbiAqIEByZXR1cm5zIHtSTUJUVGVzdFRocmVhZH1cbiAqL1xuZnVuY3Rpb24gUk1CVFRlc3RUaHJlYWQoY3ljbGljQmFycmllcikge1xuXG4gICAgdmFyIF9sb2dnZXIgPSBsb2cuZ2V0TG9nZ2VyKFwicm1idHdzXCIpO1xuICAgIHZhciBfY2FsbGJhY2tzID0ge307XG4gICAgdmFyIF9jeWNsaWNCYXJyaWVyID0gY3ljbGljQmFycmllcjtcblxuICAgIHJldHVybiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXRzIHRoZSBzdGF0ZSBvZiB0aGUgdGhyZWFkOyB0cmlnZ2VycyBzdGF0ZSB0cmFuc2l0aW9uIGNhbGxiYWNrc1xuICAgICAgICAgKiBpZiB0aGVyZSBhcmUgYW55IGFzIHNvb24gYXMgYWxsIHRocmVhZHMgaW4gdGhlIGN5Y2xpY2JhcnJpZXIgcmVhY2hlZFxuICAgICAgICAgKiB0aGUgc3RhdGVcbiAgICAgICAgICogQHBhcmFtIHtUZXN0U3RhdGV9IHN0YXRlXG4gICAgICAgICAqL1xuICAgICAgICBzZXRTdGF0ZTogZnVuY3Rpb24gc2V0U3RhdGUoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhpcy5pZCArIFwiOiByZWFjaGVkIHN0YXRlOiBcIiArIHN0YXRlKTtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgICAgIF9jeWNsaWNCYXJyaWVyLmF3YWl0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBfbG9nZ2VyLmRlYnVnKHRoYXQuaWQgKyBcIjogYWxsIHRocmVhZHMgcmVhY2hlZCBzdGF0ZTogXCIgKyBzdGF0ZSk7XG4gICAgICAgICAgICAgICAgaWYgKF9jYWxsYmFja3Nbc3RhdGVdICE9PSB1bmRlZmluZWQgJiYgX2NhbGxiYWNrc1tzdGF0ZV0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gX2NhbGxiYWNrc1tzdGF0ZV07XG4gICAgICAgICAgICAgICAgICAgIC8vX2NhbGxiYWNrc1tzdGF0ZV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF9sb2dnZXIuaW5mbyh0aGF0LmlkICsgXCI6IG5vIGNhbGxiYWNrIHJlZ2lzdGVyZWQgZm9yIHN0YXRlOiBcIiArIHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogTGlua3MgYSBjYWxsYmFjayBmdW5jdGlvbiB0byB0aGUgc3RhdGUgY2hhbmdlXG4gICAgICAgICAqIEBwYXJhbSB7VGVzdFN0YXRlfSBzdGF0ZVxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayB0aGUgZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgb24gc3RhdGUgZW50ZXJcbiAgICAgICAgICovXG4gICAgICAgIG9uU3RhdGVFbnRlcjogZnVuY3Rpb24gb25TdGF0ZUVudGVyKHN0YXRlLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgX2NhbGxiYWNrc1tzdGF0ZV0gPSBjYWxsYmFjaztcbiAgICAgICAgfSxcblxuICAgICAgICByZXRyaWdnZXJTdGF0ZTogZnVuY3Rpb24gcmV0cmlnZ2VyU3RhdGUoKSB7XG4gICAgICAgICAgICAvL3RyaWdnZXIgc3RhdGUgYWdhaW4gc2luY2Ugd2UgcmVjZWl2ZWQgYW4gJ0VSUk9SJy1NZXNzYWdlXG4gICAgICAgICAgICBzZXRTdGF0ZSh0aGlzLnN0YXRlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJpZ2dlcnMgdGhlIG5leHQgc3RhdGUgaW4gdGhlIHRocmVhZFxuICAgICAgICAgKi9cbiAgICAgICAgdHJpZ2dlck5leHRTdGF0ZTogZnVuY3Rpb24gdHJpZ2dlck5leHRTdGF0ZSgpIHtcbiAgICAgICAgICAgIHZhciBzdGF0ZXMgPSBbVGVzdFN0YXRlLklOSVQsIFRlc3RTdGF0ZS5JTklUX0RPV04sIFRlc3RTdGF0ZS5QSU5HLCBUZXN0U3RhdGUuRE9XTiwgVGVzdFN0YXRlLkNPTk5FQ1RfVVBMT0FELCBUZXN0U3RhdGUuSU5JVF9VUCwgVGVzdFN0YXRlLlVQLCBUZXN0U3RhdGUuRU5EXTtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSBUZXN0U3RhdGUuRU5EKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5leHRTdGF0ZSA9IHN0YXRlc1tzdGF0ZXMuaW5kZXhPZih0aGlzLnN0YXRlKSArIDFdO1xuICAgICAgICAgICAgICAgIF9sb2dnZXIuZGVidWcodGhpcy5pZCArIFwiOiB0cmlnZ2VyZWQgc3RhdGUgXCIgKyBuZXh0U3RhdGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUobmV4dFN0YXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaWQ6IC0xLFxuICAgICAgICBzb2NrZXQ6IG51bGwsXG4gICAgICAgIHJlc3VsdDogbmV3IFJNQlRUaHJlYWRUZXN0UmVzdWx0KClcblxuICAgIH07XG59XG5cbmZ1bmN0aW9uIFJNQlRUZXN0UmVzdWx0KCkge1xuICAgIHRoaXMucGluZ3MgPSBbXTtcbiAgICB0aGlzLnNwZWVkSXRlbXMgPSBbXTtcbiAgICB0aGlzLnRocmVhZHMgPSBbXTtcbn1cblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5hZGRUaHJlYWQgPSBmdW5jdGlvbiAocm1idFRocmVhZFRlc3RSZXN1bHQpIHtcbiAgICB0aGlzLnRocmVhZHMucHVzaChybWJ0VGhyZWFkVGVzdFJlc3VsdCk7XG59O1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLmlwX2xvY2FsID0gbnVsbDtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5pcF9zZXJ2ZXIgPSBudWxsO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLnBvcnRfcmVtb3RlID0gbnVsbDtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5udW1fdGhyZWFkcyA9IG51bGw7XG5STUJUVGVzdFJlc3VsdC5wcm90b3R5cGUuZW5jcnlwdGlvbiA9IFwiTk9ORVwiO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLnBpbmdfc2hvcnRlc3QgPSAtMTtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5waW5nX21lZGlhbiA9IC0xO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLmNsaWVudF92ZXJzaW9uID0gbnVsbDtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5waW5ncyA9IFtdO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLnNwZWVkX2Rvd25sb2FkID0gLTE7XG5STUJUVGVzdFJlc3VsdC5wcm90b3R5cGUuc3BlZWRfdXBsb2FkID0gLTE7XG5STUJUVGVzdFJlc3VsdC5wcm90b3R5cGUuc3BlZWRJdGVtcyA9IFtdO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLmJ5dGVzX2Rvd25sb2FkID0gLTE7XG5STUJUVGVzdFJlc3VsdC5wcm90b3R5cGUubnNlY19kb3dubG9hZCA9IC0xO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLmJ5dGVzX3VwbG9hZCA9IC0xO1xuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLm5zZWNfdXBsb2FkID0gLTE7XG5STUJUVGVzdFJlc3VsdC5wcm90b3R5cGUudG90YWxEb3duQnl0ZXMgPSAtMTtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS50b3RhbFVwQnl0ZXMgPSAtMTtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5iZWdpblRpbWUgPSAtMTtcblJNQlRUZXN0UmVzdWx0LnByb3RvdHlwZS5nZW9Mb2NhdGlvbnMgPSBbXTtcblJNQlRUZXN0UmVzdWx0LmNhbGN1bGF0ZU92ZXJhbGxTcGVlZEZyb21NdWx0aXBsZVRocmVhZHMgPSBmdW5jdGlvbiAodGhyZWFkcywgcGhhc2VSZXN1bHRzKSB7XG4gICAgLy9Ub3RhbFRlc3RSZXN1bHQuamF2YToxMTggKENvbW1pdCA3ZDU1MTljZTZhZDkxMjE4OTY4NjZkNGQ4ZjMwMjk5YzdjMTk5MTBkKVxuICAgIHZhciBudW1UaHJlYWRzID0gdGhyZWFkcy5sZW5ndGg7XG4gICAgdmFyIHRhcmdldFRpbWUgPSBJbmZpbml0eTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtVGhyZWFkczsgaSsrKSB7XG4gICAgICAgIHZhciBuc2VjcyA9IHBoYXNlUmVzdWx0cyh0aHJlYWRzW2ldKTtcbiAgICAgICAgaWYgKG5zZWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmIChuc2Vjc1tuc2Vjcy5sZW5ndGggLSAxXS5kdXJhdGlvbiA8IHRhcmdldFRpbWUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRUaW1lID0gbnNlY3NbbnNlY3MubGVuZ3RoIC0gMV0uZHVyYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdG90YWxCeXRlcyA9IDA7XG5cbiAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgbnVtVGhyZWFkczsgX2krKykge1xuICAgICAgICB2YXIgdGhyZWFkID0gdGhyZWFkc1tfaV07XG4gICAgICAgIHZhciBwaGFzZWRUaHJlYWQgPSBwaGFzZVJlc3VsdHModGhyZWFkKTtcbiAgICAgICAgdmFyIHBoYXNlZExlbmd0aCA9IHBoYXNlZFRocmVhZC5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHRocmVhZCAhPT0gbnVsbCAmJiBwaGFzZWRMZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0SWR4ID0gcGhhc2VkTGVuZ3RoO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBwaGFzZWRMZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGlmIChwaGFzZWRUaHJlYWRbal0uZHVyYXRpb24gPj0gdGFyZ2V0VGltZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRJZHggPSBqO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY2FsY0J5dGVzID0gdm9pZCAwO1xuICAgICAgICAgICAgaWYgKHBoYXNlZFRocmVhZFt0YXJnZXRJZHhdLmR1cmF0aW9uID09PSB0YXJnZXRUaW1lKSB7XG4gICAgICAgICAgICAgICAgLy8gbnNlY1ttYXhdID09IHRhcmdldFRpbWVcbiAgICAgICAgICAgICAgICBjYWxjQnl0ZXMgPSBwaGFzZWRUaHJlYWRbcGhhc2VkTGVuZ3RoIC0gMV0uYnl0ZXM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBieXRlczEgPSB0YXJnZXRJZHggPT09IDAgPyAwIDogcGhhc2VkVGhyZWFkW3RhcmdldElkeCAtIDFdLmJ5dGVzO1xuICAgICAgICAgICAgICAgIHZhciBieXRlczIgPSBwaGFzZWRUaHJlYWRbdGFyZ2V0SWR4XS5ieXRlcztcbiAgICAgICAgICAgICAgICB2YXIgYnl0ZXNEaWZmID0gYnl0ZXMyIC0gYnl0ZXMxO1xuICAgICAgICAgICAgICAgIHZhciBuc2VjMSA9IHRhcmdldElkeCA9PT0gMCA/IDAgOiBwaGFzZWRUaHJlYWRbdGFyZ2V0SWR4IC0gMV0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgdmFyIG5zZWMyID0gcGhhc2VkVGhyZWFkW3RhcmdldElkeF0uZHVyYXRpb247XG4gICAgICAgICAgICAgICAgdmFyIG5zZWNEaWZmID0gbnNlYzIgLSBuc2VjMTtcbiAgICAgICAgICAgICAgICB2YXIgbnNlY0NvbXBlbnNhdGlvbiA9IHRhcmdldFRpbWUgLSBuc2VjMTtcbiAgICAgICAgICAgICAgICB2YXIgZmFjdG9yID0gbnNlY0NvbXBlbnNhdGlvbiAvIG5zZWNEaWZmO1xuICAgICAgICAgICAgICAgIHZhciBjb21wZW5zYXRpb24gPSBNYXRoLnJvdW5kKGJ5dGVzRGlmZiAqIGZhY3Rvcik7XG5cbiAgICAgICAgICAgICAgICBpZiAoY29tcGVuc2F0aW9uIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICBjb21wZW5zYXRpb24gPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxjQnl0ZXMgPSBieXRlczEgKyBjb21wZW5zYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b3RhbEJ5dGVzICs9IGNhbGNCeXRlcztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGJ5dGVzOiB0b3RhbEJ5dGVzLFxuICAgICAgICBuc2VjOiB0YXJnZXRUaW1lLFxuICAgICAgICBzcGVlZDogdG90YWxCeXRlcyAqIDggLyAodGFyZ2V0VGltZSAvIDFlOSlcbiAgICB9O1xufTtcblxuUk1CVFRlc3RSZXN1bHQucHJvdG90eXBlLmNhbGN1bGF0ZUFsbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvL3NwZWVkIGl0ZW1zIGRvd25cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGhyZWFkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZG93biA9IHRoaXMudGhyZWFkc1tpXS5kb3duO1xuICAgICAgICBpZiAoZG93bi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGRvd24ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwZWVkSXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogXCJkb3dubG9hZFwiLFxuICAgICAgICAgICAgICAgICAgICB0aHJlYWQ6IGksXG4gICAgICAgICAgICAgICAgICAgIHRpbWU6IGRvd25bal0uZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGJ5dGVzOiBkb3duW2pdLmJ5dGVzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdG90YWwgPSAwO1xuICAgIHZhciB0YXJnZXRUaW1lID0gSW5maW5pdHk7XG5cbiAgICAvL2Rvd25cbiAgICB2YXIgcmVzdWx0cyA9IFJNQlRUZXN0UmVzdWx0LmNhbGN1bGF0ZU92ZXJhbGxTcGVlZEZyb21NdWx0aXBsZVRocmVhZHModGhpcy50aHJlYWRzLCBmdW5jdGlvbiAodGhyZWFkKSB7XG4gICAgICAgIHJldHVybiB0aHJlYWQuZG93bjtcbiAgICB9KTtcbiAgICB0aGlzLnNwZWVkX2Rvd25sb2FkID0gcmVzdWx0cy5zcGVlZCAvIDFlMzsgLy9icHMgLT4ga2Jwc1xuICAgIHRoaXMuYnl0ZXNfZG93bmxvYWQgPSByZXN1bHRzLmJ5dGVzO1xuICAgIHRoaXMubnNlY19kb3dubG9hZCA9IHJlc3VsdHMubnNlYztcblxuICAgIC8vc3BlZWQgaXRlbXMgdXBcbiAgICBmb3IgKHZhciBfaTIgPSAwOyBfaTIgPCB0aGlzLnRocmVhZHMubGVuZ3RoOyBfaTIrKykge1xuICAgICAgICB2YXIgdXAgPSB0aGlzLnRocmVhZHNbX2kyXS51cDtcbiAgICAgICAgaWYgKHVwLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAodmFyIF9qID0gMDsgX2ogPCB1cC5sZW5ndGg7IF9qKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwZWVkSXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogXCJ1cGxvYWRcIixcbiAgICAgICAgICAgICAgICAgICAgdGhyZWFkOiBfaTIsXG4gICAgICAgICAgICAgICAgICAgIHRpbWU6IHVwW19qXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgYnl0ZXM6IHVwW19qXS5ieXRlc1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy91cFxuICAgIHJlc3VsdHMgPSBSTUJUVGVzdFJlc3VsdC5jYWxjdWxhdGVPdmVyYWxsU3BlZWRGcm9tTXVsdGlwbGVUaHJlYWRzKHRoaXMudGhyZWFkcywgZnVuY3Rpb24gKHRocmVhZCkge1xuICAgICAgICByZXR1cm4gdGhyZWFkLnVwO1xuICAgIH0pO1xuICAgIHRoaXMuc3BlZWRfdXBsb2FkID0gcmVzdWx0cy5zcGVlZCAvIDFlMzsgLy9icHMgLT4ga2Jwc1xuICAgIHRoaXMuYnl0ZXNfdXBsb2FkID0gcmVzdWx0cy5ieXRlcztcbiAgICB0aGlzLm5zZWNfdXBsb2FkID0gcmVzdWx0cy5uc2VjO1xuXG4gICAgLy9waW5nXG4gICAgdmFyIHBpbmdzID0gdGhpcy50aHJlYWRzWzBdLnBpbmdzO1xuICAgIGZvciAodmFyIF9pMyA9IDA7IF9pMyA8IHBpbmdzLmxlbmd0aDsgX2kzKyspIHtcbiAgICAgICAgdGhpcy5waW5ncy5wdXNoKHtcbiAgICAgICAgICAgIHZhbHVlOiBwaW5nc1tfaTNdLmNsaWVudCxcbiAgICAgICAgICAgIHZhbHVlX3NlcnZlcjogcGluZ3NbX2kzXS5zZXJ2ZXIsXG4gICAgICAgICAgICB0aW1lX25zOiBwaW5nc1tfaTNdLnRpbWVOc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvL2FkZCB0aW1lX25zIHRvIGdlb0xvY2F0aW9uc1xuICAgIGZvciAodmFyIF9pNCA9IDA7IF9pNCA8IHRoaXMuZ2VvTG9jYXRpb25zLmxlbmd0aDsgX2k0KyspIHtcbiAgICAgICAgdmFyIGdlb0xvY2F0aW9uID0gdGhpcy5nZW9Mb2NhdGlvbnNbX2k0XTtcbiAgICAgICAgZ2VvTG9jYXRpb25bJ3RpbWVfbnMnXSA9IChnZW9Mb2NhdGlvbi50c3RhbXAgLSB0aGlzLmJlZ2luVGltZSkgKiAxZTY7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gUk1CVFRocmVhZFRlc3RSZXN1bHQoKSB7XG4gICAgdGhpcy5kb3duID0gW107IC8vbWFwIG9mIGJ5dGVzL25zZWNcbiAgICB0aGlzLnVwID0gW107XG4gICAgdGhpcy5waW5ncyA9IFtdO1xufVxuLy9ubyBpbmhlcml0YW5jZShvdGhlciB0aGFuIGluIEphdmEgUk1CVENsaWVudClcbi8vUk1CVFRocmVhZFRlc3RSZXN1bHQucHJvdG90eXBlID0gbmV3IFJNQlRUZXN0UmVzdWx0KCk7XG5STUJUVGhyZWFkVGVzdFJlc3VsdC5wcm90b3R5cGUuZG93biA9IG51bGw7XG5STUJUVGhyZWFkVGVzdFJlc3VsdC5wcm90b3R5cGUudXAgPSBudWxsO1xuUk1CVFRocmVhZFRlc3RSZXN1bHQucHJvdG90eXBlLnBpbmdzID0gbnVsbDtcblJNQlRUaHJlYWRUZXN0UmVzdWx0LnByb3RvdHlwZS50b3RhbERvd25CeXRlcyA9IC0xO1xuUk1CVFRocmVhZFRlc3RSZXN1bHQucHJvdG90eXBlLnRvdGFsVXBCeXRlcyA9IC0xO1xuXG5mdW5jdGlvbiBSTUJUUGluZ1Jlc3VsdCgpIHt9XG5STUJUUGluZ1Jlc3VsdC5wcm90b3R5cGUuY2xpZW50ID0gLTE7XG5STUJUUGluZ1Jlc3VsdC5wcm90b3R5cGUuc2VydmVyID0gLTE7XG5STUJUUGluZ1Jlc3VsdC5wcm90b3R5cGUudGltZU5zID0gLTE7XG5cbi8qKlxuICogQGNhbGxiYWNrIFJNQlRDb250cm9sU2VydmVyUmVnaXN0cmF0aW9uUmVzcG9uc2VDYWxsYmFja1xuICogQHBhcmFtIHtSTUJUQ29udHJvbFNlcnZlclJlZ2lzdHJhdGlvblJlc3BvbnNlfSBqc29uXG4gKi9cbnZhciBSTUJURXJyb3IgPSB7XG4gICAgTk9UX1NVUFBPUlRFRDogXCJXZWJTb2NrZXRzIGFyZSBub3Qgc3VwcG9ydGVkXCIsXG4gICAgU09DS0VUX0lOSVRfRkFJTEVEOiBcIldlYlNvY2tldCBpbml0aWFsaXphdGlvbiBmYWlsZWRcIixcbiAgICBDT05ORUNUX0ZBSUxFRDogXCJjb25uZWN0aW9uIHRvIHRlc3Qgc2VydmVyIGZhaWxlZFwiLFxuICAgIFNVQk1JVF9GQUlMRUQ6IFwiRXJyb3IgZHVyaW5nIHN1Ym1pc3Npb24gb2YgdGVzdCByZXN1bHRzXCIsXG4gICAgUkVHSVNUUkFUSU9OX0ZBSUxFRDogXCJFcnJvciBkdXJpbmcgdGVzdCByZWdpc3RyYXRpb25cIlxufTtcblwidXNlIHN0cmljdFwiO1xuXG4vL3BvbHlmaWxsIGZvciBtaWNyb3NlY29uZC10aW1lXG4vL2h0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC81NDM4NjUwXG5cbihmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFEYXRlLm5vdykge1xuICAgICAgICBEYXRlLm5vdyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlIGJhc2UgcGVyZiBvYmplY3RcbiAgICBpZiAodHlwZW9mIHdpbmRvdy5wZXJmb3JtYW5jZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgd2luZG93LnBlcmZvcm1hbmNlID0ge307XG4gICAgfVxuXG4gICAgaWYgKCF3aW5kb3cucGVyZm9ybWFuY2Uubm93IHx8IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2YXIgbm93T2Zmc2V0ID0gRGF0ZS5ub3coKTtcblxuICAgICAgICBpZiAocGVyZm9ybWFuY2UudGltaW5nICYmIHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQpIHtcbiAgICAgICAgICAgIG5vd09mZnNldCA9IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQ7XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24gbm93KCkge1xuICAgICAgICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBub3dPZmZzZXQ7XG4gICAgICAgIH07XG4gICAgfVxufSkoKTtcblxuZnVuY3Rpb24gbm93TXMoKSB7XG4gICAgcmV0dXJuIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbn1cblxuZnVuY3Rpb24gbm93TnMoKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQod2luZG93LnBlcmZvcm1hbmNlLm5vdygpICogMWU2KTsgLy9mcm9tIG1zIHRvIG5zXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBjeWNsaWMgYmFycmllclxuICogQHBhcmFtIHtudW1iZXJ9IHBhcnRpZXMgdGhlIG51bWJlciBvZiB0aHJlYWRzIHRoYXQgbXVzdCBpbnZva2UgYXdhaXQoKVxuICogICAgICBiZWZvcmUgdGhlIGJhcnJpZXIgaXMgdHJpcHBlZFxuICogQHNlZSBodHRwOi8vZG9jcy5vcmFjbGUuY29tL2phdmFzZS83L2RvY3MvYXBpL2phdmEvdXRpbC9jb25jdXJyZW50L0N5Y2xpY0JhcnJpZXIuaHRtbFxuICovXG5mdW5jdGlvbiBDeWNsaWNCYXJyaWVyKHBhcnRpZXMpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBfcGFydGllcyA9IHBhcnRpZXM7XG4gICAgdmFyIF9jYWxsYmFja3MgPSBbXTtcblxuICAgIHZhciByZWxlYXNlID0gZnVuY3Rpb24gcmVsZWFzZSgpIHtcbiAgICAgICAgLy9maXJzdCwgY29weSBhbmQgY2xlYXIgY2FsbGJhY2tzXG4gICAgICAgIC8vdG8gcHJvaGliaXQgdGhhdCBhIGNhbGxiYWNrIHJlZ2lzdGVycyBiZWZvcmUgYWxsIG90aGVycyBhcmUgcmVsZWFzZWRcbiAgICAgICAgdmFyIHRtcCA9IF9jYWxsYmFja3Muc2xpY2UoKTtcbiAgICAgICAgX2NhbGxiYWNrcyA9IFtdO1xuICAgICAgICBzZWxmLnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfcGFydGllczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy9wcmV2ZW50IHNpZGUgZWZmZWN0cyBpbiBsYXN0IGZ1bmN0aW9uIHRoYXQgY2FsbGVkIFwiYXdhaXRcIlxuICAgICAgICAgICAgICAgIHRtcFtpXSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCAxKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdhaXRzIHVudGlsIGFsbCBwYXJ0aWVzIGhhdmUgaW52b2tlZCBhd2FpdCBvbiB0aGlzIGJhcnJpZXJcbiAgICAgICAgICogVGhlIGN1cnJlbnQgY29udGV4dCBpcyBkaXNhYmxlZCBpbiBhbnkgY2FzZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQXMgc29vbiBhcyBhbGwgdGhyZWFkcyBoYXZlIGNhbGxlZCAnYXdhaXQnLCBhbGwgY2FsbGJhY2tzIHdpbGxcbiAgICAgICAgICogYmUgZXhlY3V0ZWRcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICovXG4gICAgICAgIGF3YWl0OiBmdW5jdGlvbiBfYXdhaXQoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIF9jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoX2NhbGxiYWNrcy5sZW5ndGggPT09IF9wYXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgcmVsZWFzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9O1xufTtcblxuLyoqXG4gKiBGaW5kcyB0aGUgbWVkaWFuIG51bWJlciBpbiB0aGUgZ2l2ZW4gYXJyYXlcbiAqIGh0dHA6Ly9jYXNleWp1c3R1cy5jb20vZmluZGluZy10aGUtbWVkaWFuLW9mLWFuLWFycmF5LXdpdGgtamF2YXNjcmlwdFxuICogQHBhcmFtIHtBcnJheX0gdmFsdWVzXG4gKiBAcmV0dXJucyB7TnVtYmVyfSB0aGUgbWVkaWFuXG4gKi9cbk1hdGgubWVkaWFuID0gZnVuY3Rpb24gKHZhbHVlcykge1xuICAgIHZhbHVlcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhIC0gYjtcbiAgICB9KTtcblxuICAgIHZhciBoYWxmID0gTWF0aC5mbG9vcih2YWx1ZXMubGVuZ3RoIC8gMik7XG5cbiAgICBpZiAodmFsdWVzLmxlbmd0aCAlIDIpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlc1toYWxmXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKHZhbHVlc1toYWxmIC0gMV0gKyB2YWx1ZXNbaGFsZl0pIC8gMi4wO1xuICAgIH1cbn07XG5cbi8vIFBvbHlmaWxsIGxvZzEwIGZvciBpbnRlcm5ldCBleHBsb3JlclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZGUvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvTWF0aC9sb2cxMCNQb2x5ZmlsbFxuTWF0aC5sb2cxMCA9IE1hdGgubG9nMTAgfHwgZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4gTWF0aC5sb2coeCkgLyBNYXRoLkxOMTA7XG59O1xuXG4vL1wibG9nbGV2ZWxcIiBtb2R1bGUgaXMgdXNlZCwgYnV0IGlmIG5vdCBhdmFpbGFibGUsIGl0IHdpbGwgZmFsbGJhY2sgdG8gY29uc29sZS5sb2dcbnNlbGYubG9nID0gc2VsZi5sb2cgfHwge1xuICAgIGRlYnVnOiBmdW5jdGlvbiBkZWJ1ZygpIHtcbiAgICAgICAgdmFyIF9jb25zb2xlO1xuXG4gICAgICAgIChfY29uc29sZSA9IGNvbnNvbGUpLmxvZy5hcHBseShfY29uc29sZSwgYXJndW1lbnRzKTtcbiAgICB9LFxuICAgIHRyYWNlOiBmdW5jdGlvbiB0cmFjZSgpIHtcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgIH0sXG4gICAgaW5mbzogZnVuY3Rpb24gaW5mbygpIHtcbiAgICAgICAgdmFyIF9jb25zb2xlMjtcblxuICAgICAgICAoX2NvbnNvbGUyID0gY29uc29sZSkuaW5mby5hcHBseShfY29uc29sZTIsIGFyZ3VtZW50cyk7XG4gICAgfSxcbiAgICB3YXJuOiBmdW5jdGlvbiB3YXJuKCkge1xuICAgICAgICB2YXIgX2NvbnNvbGUzO1xuXG4gICAgICAgIChfY29uc29sZTMgPSBjb25zb2xlKS53YXJuLmFwcGx5KF9jb25zb2xlMywgYXJndW1lbnRzKTtcbiAgICB9LFxuICAgIGVycm9yOiBmdW5jdGlvbiBlcnJvcigpIHtcbiAgICAgICAgdmFyIF9jb25zb2xlNDtcblxuICAgICAgICAoX2NvbnNvbGU0ID0gY29uc29sZSkuZXJyb3IuYXBwbHkoX2NvbnNvbGU0LCBhcmd1bWVudHMpO1xuICAgIH0sXG4gICAgc2V0TGV2ZWw6IGZ1bmN0aW9uIHNldExldmVsKCkge30sXG4gICAgZ2V0TG9nZ2VyOiBmdW5jdGlvbiBnZXRMb2dnZXIoKSB7XG4gICAgICAgIHJldHVybiBsb2c7XG4gICAgfVxufTtcblxuLy9Qb2x5ZmlsbFxuaWYgKHR5cGVvZiBPYmplY3QuYXNzaWduICE9ICdmdW5jdGlvbicpIHtcbiAgICBPYmplY3QuYXNzaWduID0gZnVuY3Rpb24gKHRhcmdldCwgdmFyQXJncykge1xuICAgICAgICAvLyAubGVuZ3RoIG9mIGZ1bmN0aW9uIGlzIDJcbiAgICAgICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgICAgIGlmICh0YXJnZXQgPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVHlwZUVycm9yIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0byA9IE9iamVjdCh0YXJnZXQpO1xuXG4gICAgICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICB2YXIgbmV4dFNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF07XG5cbiAgICAgICAgICAgIGlmIChuZXh0U291cmNlICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBTa2lwIG92ZXIgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBuZXh0S2V5IGluIG5leHRTb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgYnVncyB3aGVuIGhhc093blByb3BlcnR5IGlzIHNoYWRvd2VkXG4gICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobmV4dFNvdXJjZSwgbmV4dEtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvW25leHRLZXldID0gbmV4dFNvdXJjZVtuZXh0S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG87XG4gICAgfTtcbn1cblxuLy9cImhpZGRlblwiIHBvbHlmaWxsIChpbiB0aGlzIGNhc2U6IGFsd2F5cyB2aXNpYmxlKVxuaWYgKHR5cGVvZiBkb2N1bWVudC5oaWRkZW4gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBkb2N1bWVudC5oaWRkZW4gPSBmYWxzZTtcbn0iXX0=
