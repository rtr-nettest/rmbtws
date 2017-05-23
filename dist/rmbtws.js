/*!******************************************************************************
 * @license
 * Copyright 2015-2017 Thomas Schreiber
 * Copyright 2017      Rundfunk und Telekom Regulierungs-GmbH (RTR-GmbH)
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

//structure from: http://www.typescriptlang.org/Playground

var RMBTTest = function () {
    var _server_override = "wss://developv4-rmbtws.netztest.at:19002";

    var debug = function debug(text) {
        //return; //no debug
        $("#debug").prepend(text + "\n");
        console.log(text);
    };

    var _chunkSize;
    var MAX_CHUNK_SIZE = 4194304;
    var MIN_CHUNK_SIZE;
    var DEFAULT_CHUNK_SIZE;
    var _changeChunkSizes = false;

    /**
     *  @var rmbtTestConfig RMBTTestConfig
     **/
    var _rmbtTestConfig;
    var _rmbtTestResult = null;
    var _errorCallback = null;

    var _state;
    var _stateChangeMs;
    var _statesInfo = {
        durationInitMs: 2500,
        durationPingMs: 500,
        durationUpMs: -1,
        durationDownMs: -1
    };

    var _intermediateResult = new RMBTIntermediateResult();

    var _threads = [];
    var _arrayBuffers = {};
    var _endArrayBuffers = {};

    var _cyclicBarrier;
    var _numThreadsAllowed;
    var _numDownloadThreads = 0;
    var _numUploadThreads = 0;

    var _bytesPerSecsPretest = [];
    var _totalBytesPerSecsPretest = 0;

    //this is a observable/subject
    //http://addyosmani.com/resources/essentialjsdesignpatterns/book/#observerpatternjavascript
    //RMBTTest.prototype = new Subject();

    /**
     *
     * @param {RMBTTestConfig} rmbtTestConfig
     * @returns {}
     */
    function RMBTTest(rmbtTestConfig) {
        //init socket
        _rmbtTestConfig = rmbtTestConfig; // = new RMBTTestConfig();
        _state = TestState.INIT;
    }

    /**
     * Sets the state of the test, notifies the observers if
     * the state changed
     * @param {TestState} state
     */
    function setState(state) {
        if (_state === undefined || _state !== state) {
            _state = state;
            _stateChangeMs = performance.now();
        }
    }

    /**
     * Set the fallback function
     * in case the websocket-test
     * fails for any reason
     * @param {Function} fct
     */
    RMBTTest.prototype.onError = function (fct) {
        _errorCallback = fct;
    };

    /**
     * Calls the error function (but only once!)
     * @param {RMBTError} error
     */
    var callErrorCallback = function callErrorCallback(error) {
        if (!error === RMBTError.NOT_SUPPORTED) {
            setState(TestState.ERROR);
        }
        if (_errorCallback !== null) {
            var t = _errorCallback;
            _errorCallback = null;
            t();
        }
    };

    RMBTTest.prototype.startTest = function () {
        //see if websockets are supported
        if (window.WebSocket === undefined) {
            callErrorCallback(RMBTError.NOT_SUPPORTED);
            return;
        }

        setState(TestState.INIT);
        _rmbtTestResult = new RMBTTestResult();
        //connect to controlserver
        getDataCollectorInfo(_rmbtTestConfig);

        obtainControlServerRegistration(_rmbtTestConfig, function (response) {
            _numThreadsAllowed = parseInt(response.test_numthreads);
            _cyclicBarrier = new CyclicBarrier(_numThreadsAllowed);
            _statesInfo.durationDownMs = response.test_duration * 1e3;
            _statesInfo.durationUpMs = response.test_duration * 1e3;

            //@TODO: Nicer
            //if there is testVisualization, make use of it!
            if (TestEnvironment.getTestVisualization() !== null) {
                TestEnvironment.getTestVisualization().updateInfo(response.test_server_name, response.client_remote_ip, response.provider, response.test_uuid);
            }

            var continuation = function continuation() {
                debug("got geolocation, obtaining token and websocket address");
                setState(TestState.WAIT);

                //wait if we have to
                window.setTimeout(function () {
                    setState(TestState.INIT);
                    _rmbtTestResult.beginTime = Date.now();
                    //n threads
                    for (var i = 0; i < _numThreadsAllowed; i++) {
                        var thread = new RMBTTestThread(_cyclicBarrier);
                        thread.id = i;
                        _rmbtTestResult.addThread(thread.result);

                        //only one thread will call after upload is finished
                        conductTest(response, thread, function () {
                            debug("All tests finished");
                            wsGeoTracker.stop();
                            _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
                            _rmbtTestResult.calculateAll();
                            submitResults(response, function () {
                                setState(TestState.END);
                            });
                        });

                        _threads.push(thread);
                    }
                }, response.test_wait * 1e3);
            };

            var wsGeoTracker;
            //get the user's geolocation
            if (TestEnvironment.getGeoTracker() !== null) {
                wsGeoTracker = TestEnvironment.getGeoTracker();
                continuation();
            } else {
                wsGeoTracker = new GeoTracker();
                debug("getting geolocation");
                wsGeoTracker.start(function () {
                    continuation();
                });
            }
        });
    };

    /**
     *
     * @returns {RMBTIntermediateResult}
     */
    RMBTTest.prototype.getIntermediateResult = function () {
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
            _intermediateResult.pingNano = _rmbtTestResult.ping_median;

            if (_intermediateResult.status === TestState.DOWN) {
                var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.down;
                });

                _intermediateResult.downBitPerSec = results.speed;
                _intermediateResult.downBitPerSecLog = (log10(_intermediateResult.downBitPerSec / 1e6) + 2) / 4;
            }

            if (_intermediateResult.status === TestState.UP) {
                var _results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.up;
                });

                _intermediateResult.upBitPerSec = _results.speed;
                _intermediateResult.upBitPerSecLog = (log10(_intermediateResult.upBitPerSec / 1e6) + 2) / 4;
            }
        }
        return _intermediateResult;
    };

    /**
     * Conduct the test
     * @param {RMBTControlServerRegistrationResponse} registrationResponse
     * @param {RMBTTestThread} thread info about the thread/local thread data structures
     * @param {Callback} callback as soon as all tests are finished
     */
    function conductTest(registrationResponse, thread, callback) {
        var server = (registrationResponse.test_server_encryption ? "wss://" : "ws://") + registrationResponse.test_server_address + ":" + registrationResponse.test_server_port;
        //server = server_override;
        debug(server);

        var errorFunctions = function () {
            return {
                IGNORE: function IGNORE() {
                    //ignore error :)
                },
                CALLGLOBALHANDLER: function CALLGLOBALHANDLER() {
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
            debug(thread.id + ": start short download");
            _chunkSize = MIN_CHUNK_SIZE;

            //all threads download, according to specification
            shortDownloadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.PING, function () {
            setState(TestState.PING);
            debug(thread.id + ": starting ping");
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
                _chunkSize = chunkSizes.chunkSize;
                _bytesPerSecsPretest = [];
            }

            //maybe not all threads have to conduct a download speed test
            if (thread.id < _numDownloadThreads) {
                downloadTest(thread, registrationResponse.test_duration);
            } else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.INIT_UP, function () {
            setState(TestState.INIT_UP);
            _chunkSize = MIN_CHUNK_SIZE;

            shortUploadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.UP, function () {
            setState(TestState.UP);

            //set threads and chunksize
            if (_bytesPerSecsPretest.length > 0) {
                var chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.uploadThreadsLimitsMbit, true);
                _numUploadThreads = chunkSizes.numThreads;
                _chunkSize = chunkSizes.chunkSize;
                _bytesPerSecsPretest = [];
            }

            //maybe not all threads have to conduct an upload speed test
            if (thread.id < _numUploadThreads) {
                uploadTest(thread, registrationResponse.test_duration);
            } else {
                //the socket is not needed anymore,
                //close it to free up resources
                thread.socket.onerror = errorFunctions.IGNORE;
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

        thread.socket.onmessage = function (event) {
            //debug("thread " + thread.id + " triggered, state " + thread.state + " event: " + event);

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
                debug(thread.id + "Chunksizes: min " + MIN_CHUNK_SIZE + ", max: " + MAX_CHUNK_SIZE + ", default: " + DEFAULT_CHUNK_SIZE);
            } else if (event.data.indexOf("RMBTv") === 0) {
                //get server version
                var version = event.data.substring(5).trim();
                _rmbtTestConfig.client_version = version;
                if (version.indexOf("1.") === 0) {
                    _changeChunkSizes = true;
                } else if (version.indexOf("0.3") === 0) {
                    _changeChunkSizes = false;
                } else {
                    debug("unknown server version: " + version);
                }
            } else if (event.data === "ACCEPT TOKEN QUIT\n") {
                thread.socket.send("TOKEN " + token + "\n");
            } else if (event.data === "OK\n" && thread.state === TestState.INIT) {
                debug(thread.id + ": Token accepted");
            } else if (event.data === "ERR\n") {
                errorHandler();
                debug("got error msg");
            } else if (event.data.indexOf("ACCEPT GETCHUNKS") === 0) {
                thread.triggerNextState();
            }
        };
    }

    /**
     * Calcuate chunk size, total pretest bandwirth according
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

        debug("total: circa " + _totalBytesPerSecsPretest / 1000 + " KB/sec");
        debug("total: circa " + _totalBytesPerSecsPretest * 8 / 1e6 + " MBit/sec");

        //set number of upload threads according to mbit/s measured
        var mbits = _totalBytesPerSecsPretest * 8 / 1e6;
        var threads = 0;
        Object.keys(threadLimits).forEach(function (thresholdMbit) {
            if (mbits > thresholdMbit) {
                threads = threadLimits[thresholdMbit];
            }
        });
        threads = Math.min(_numThreadsAllowed, threads);
        debug("set number of threads to be used in upcoming speed test to: " + threads);

        //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
        var calculatedChunkSize = _totalBytesPerSecsPretest / (1000 / (_rmbtTestConfig.measurementPointsTimespan / 2));

        //round to the nearest full KB
        calculatedChunkSize -= calculatedChunkSize % 1024;

        //but min 4KiB
        calculatedChunkSize = Math.max(MIN_CHUNK_SIZE, calculatedChunkSize);

        //and max MAX_CHUNKSIZE
        calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);

        debug("calculated chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");

        if (limitToExistingChunks) {
            //get closest chunk size where there are saved chunks available
            var closest = Number.POSITIVE_INFINITY;
            Object.keys(_arrayBuffers).forEach(function (key) {
                var diff = Math.abs(calculatedChunkSize - key);
                if (diff < Math.abs(calculatedChunkSize - closest)) {
                    closest = key;
                } else {
                    //if there is already a closer chunk selected, we don't need this
                    //anymore in this test and can dereference it to save heap memory
                    delete _arrayBuffers[key];
                    delete _endArrayBuffers[key];
                }
            });

            calculatedChunkSize = closest;
            debug("fallback to existing chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");
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
        var startTime = nowNs() / 1e6; //ms since page load
        var n = 1;
        var bytesReceived = 0;
        var chunksize = _chunkSize;

        var loop = function loop() {
            downloadChunks(thread, n, chunksize, function (msg) {
                bytesReceived += n * chunksize;
                debug(thread.id + ": " + msg);
                var timeNs = parseInt(msg.substring(5));

                var now = nowNs() / 1e6;
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
     * @param {Number} total how many chunks to download
     * @param {RMBTThread} thread containing an open socket
     * @param {Callback} onsuccess expects one argument (String)
     */
    function downloadChunks(thread, total, chunkSize, onsuccess) {
        //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
        var socket = thread.socket;
        var remainingChunks = total;
        var expectBytes = _chunkSize * total;
        var totalRead = 0;

        var downloadChunkListener = function downloadChunkListener(event) {
            if (typeof event.data === 'string') {
                return;
            }

            //var lastByte;
            //console.log("received chunk with " + line.length + " bytes");
            totalRead = totalRead + event.data.byteLength;

            //in previous versions, the last byte was sent as a single websocket frame,
            //so we have to maintain compatibility at this time
            if (event.data.byteLength === chunkSize || event.data.byteLength === 1) {
                remainingChunks--;
            }

            //zero junks remain - get time
            if (remainingChunks === 0) {
                //get info
                socket.onmessage = function (line) {
                    var infomsg = line.data;
                    onsuccess(infomsg);
                };

                socket.send("OK\n");
                _endArrayBuffers[chunkSize] = event.data;
            } else {
                if (!_arrayBuffers.hasOwnProperty(chunkSize)) {
                    _arrayBuffers[chunkSize] = [];
                }
                if (_arrayBuffers[chunkSize].length < _rmbtTestConfig.savedChunks) {
                    _arrayBuffers[chunkSize].push(event.data);
                }
            }
        };
        socket.onmessage = downloadChunkListener;
        debug(thread.id + ": downloading " + total + " chunks, " + expectBytes / 1000 + " KB");
        var send = "GETCHUNKS " + total + (chunkSize !== DEFAULT_CHUNK_SIZE ? " " + chunkSize : "") + "\n";
        socket.send(send);
    }

    function pingTest(thread) {
        var shortestPing = Infinity;
        var prevListener = thread.socket.onmessage;
        var pingsRemaining = _rmbtTestConfig.numPings;

        var onsuccess = function onsuccess(pingResult) {
            pingsRemaining--;

            thread.result.pings.push(pingResult);

            if (pingResult.client < shortestPing) {
                shortestPing = pingResult.client;
            }
            debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");

            if (pingsRemaining > 0) {
                //wait for new 'ACCEPT'-message
                thread.socket.onmessage = function (event) {
                    if (event.data === "ACCEPT GETCHUNKS GETTIME PUT PUTNORESULT PING QUIT\n") {
                        ping(thread, onsuccess);
                    } else {
                        debug("unexpected error during ping test");
                    }
                };
            } else {
                //"break

                //median ping
                var tArray = [];
                for (var i = 0; i < thread.result.pings.length; i++) {
                    tArray.push(thread.result.pings[i].client);
                }
                _rmbtTestResult.ping_median = Math.median(tArray);

                debug(thread.id + ": shortest: " + Math.round(shortestPing / 1000) / 1000 + " ms");
                _rmbtTestResult.ping_shortest = shortestPing;
                thread.socket.onmessage = prevListener;
            }
        };
        ping(thread, onsuccess);
    }

    /**
     *
     * @param {RMBTTestThread} thread
     * @param {Callback} onsuccess upon success
     */
    function ping(thread, onsuccess) {
        var begin;
        var clientDuration;
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

        var interval;
        var lastRead;
        var lastChunk = null;
        var lastTime = null;

        //read chunk only at some point in the future to save ressources
        interval = window.setInterval(function () {
            if (lastChunk === null) {
                return;
            }

            //nothing new happened, do not simulate a accuracy that does not exist
            if (lastReportedChunks === readChunks) {
                return;
            }
            lastReportedChunks = readChunks;

            var now = nowNs();
            debug(thread.id + ": " + lastRead + "|" + _rmbtTestConfig.measurementPointsTimespan + "|" + now + "|" + readChunks);

            var lastByte = new Uint8Array(lastChunk, lastChunk.byteLength - 1, 1);

            //add result
            var duration = lastTime - start;
            thread.result.down.push({
                duration: duration,
                bytes: totalRead
            });

            //var now = nowNs();
            lastRead = now;

            if (lastByte[0] >= 0xFF) {
                debug(thread.id + ": received end chunk");
                window.clearInterval(interval);

                //last chunk received - get time
                thread.socket.onmessage = function (event) {
                    //TIME
                    debug(event.data);
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
        var startTime = nowNs() / 1e6; //ms since page load
        var n = 1;
        var bytesSent = 0;
        var chunkSize = _chunkSize;

        var performanceTest = window.setTimeout(function () {
            var endTime = nowNs() / 1e6;
            var duration = endTime - startTime;
            debug("diff:" + (duration - durationMs) + " (" + (duration - durationMs) / durationMs + " %)");
        }, durationMs);

        var loop = function loop() {
            uploadChunks(thread, n, chunkSize, function (msg) {
                bytesSent += n * chunkSize;
                debug(thread.id + ": " + msg);

                var now = nowNs() / 1e6;
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
     * @param {Number} total how many chunks to upload
     * @param {RMBTThread} thread containing an open socket
     * @param {Callback} onsuccess expects one argument (String)
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

        debug(thread.id + ": uploading " + total + " chunks, " + chunkSize * total / 1000 + " KB");
        socket.send("PUTNORESULT" + (_changeChunkSizes ? " " + chunkSize : "") + "\n"); //Put no result
        for (var i = 0; i < total; i++) {
            var blob;
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
        var fixedUnderrunBytes = _totalBytesPerSecsPretest / 2 / _numUploadThreads;

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
                debug(thread.id + ": is 7.2 sec in, got data for " + lastDurationInfo);
                //if measurements are for < 7sec, give it time
                if (lastDurationInfo < duration * 1e9 && timeoutExtensionsMs < 3000) {
                    window.setTimeout(timeoutFunction, 250);
                    timeoutExtensionsMs += 250;
                } else {
                    //kill it with force!
                    debug(thread.id + ": didn't finish, timeout extended by " + timeoutExtensionsMs + " ms, last info for " + lastDurationInfo);
                    thread.socket.onerror = function () {};

                    //do nothing, we kill it on purpose
                    thread.socket.close();
                    thread.socket.onmessage = previousListener;
                    debug(thread.id + ": socket now closed: " + thread.socket.readyState);
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
                //debug(thread.id + ": buffer underrun");
                for (var i = 0; i < sendAtOnceChunks; i++) {
                    thread.socket.send(_arrayBuffers[_chunkSize][i % _arrayBuffers[_chunkSize].length]);
                }
            } else {
                //debug(thread.id + ": no buffer underrun");
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
            thread.socket.send(_endArrayBuffers[_chunkSize]);
            thread.socket.send("QUIT\n");
        }, duration * 1e3);

        debug(thread.id + ": set timeout");

        var pattern = /TIME (\d+) BYTES (\d+)/;
        var patternEnd = /TIME (\d+)/;
        var uploadListener = function uploadListener(event) {
            //start conducting the test
            if (event.data === "OK\n") {
                sendChunks();
            }

            //intermediate result - save it!
            //TIME 6978414829 BYTES 5738496
            //debug(thread.id + ": rec: " + event.data);
            var matches = pattern.exec(event.data);
            if (matches !== null) {
                var data = {
                    duration: parseInt(matches[1]),
                    bytes: parseInt(matches[2])
                };
                lastDurationInfo = data.duration;
                //debug(thread.id + ": " + JSON.stringify(data));
                thread.result.up.push(data);
            } else {
                matches = patternEnd.exec(event.data);
                if (matches !== null) {
                    //statistic for end match - upload phase complete
                    receivedEndTime = true;
                    debug("Upload duration: " + matches[1]);
                    thread.socket.onmessage = previousListener;
                }
            }
        };
        thread.socket.onmessage = uploadListener;

        thread.socket.send("PUT" + (_chunkSize !== DEFAULT_CHUNK_SIZE ? " " + _chunkSize : "") + "\n");
    }

    /**
     *
     * @param {RMBTTestConfig} rmbtTestConfig
     * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
     */
    function obtainControlServerRegistration(rmbtTestConfig, onsuccess) {
        var json_data = {
            version: rmbtTestConfig.version,
            language: rmbtTestConfig.language,
            uuid: rmbtTestConfig.uuid,
            type: rmbtTestConfig.type,
            version_code: rmbtTestConfig.version_code,
            client: rmbtTestConfig.client,
            timezone: rmbtTestConfig.timezone,
            time: new Date().getTime()
        };

        if (typeof userServerSelection !== "undefined" && userServerSelection > 0 && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
            json_data['prefer_server'] = UserConf.preferredServer;
            json_data['user_server_selection'] = userServerSelection;
        }

        $.ajax({
            url: rmbtTestConfig.controlServerURL + rmbtTestConfig.controlServerRegistrationResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify(json_data),
            success: function success(data) {
                var config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            },
            error: function error() {
                debug("error getting testID");
            }
        });
    }

    /**
     * get "data collector" metadata (like browser family)
     * @param {RMBTTestConfig} rmbtTestConfig
     */
    function getDataCollectorInfo(rmbtTestConfig) {
        $.ajax({
            url: rmbtTestConfig.controlServerURL + rmbtTestConfig.controlServerDataCollectorResource,
            type: "get",
            dataType: "json",
            contentType: "application/json",
            success: function success(data) {
                rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                rmbtTestConfig.model = data.product;
                //rmbtTestConfig.platform = data.product;
                rmbtTestConfig.os_version = data.version;
            },
            error: function error() {
                debug("error getting data collection response");
            }
        });
    }

    /**
     *
     * @param {RMBTControlServerRegistrationResponse} registrationResponse
     * @param {Callback} callback
     */
    function submitResults(registrationResponse, callback) {
        var json_data = {
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
            test_ping_shortest: _rmbtTestResult.ping_shortest,
            test_speed_download: _rmbtTestResult.speed_download,
            test_speed_upload: _rmbtTestResult.speed_upload,
            test_token: registrationResponse.test_token,
            time: _rmbtTestResult.beginTime,
            timezone: "Europe/Vienna",
            type: "DESKTOP",
            version_code: "1",
            speed_detail: _rmbtTestResult.speedItems,
            user_server_selection: _rmbtTestConfig.userServerSelection
        };
        var json = JSON.stringify(json_data);
        debug("Submit size: " + json.length);
        $.ajax({
            url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: json,
            success: function success(data) {
                //var config = new RMBTControlServerRegistrationResponse(data);
                //onsuccess(config);
                debug("https://develop.netztest.at/en/Verlauf?" + registrationResponse.test_uuid);
                //window.location.href = "https://develop.netztest.at/en/Verlauf?" + registrationResponse.test_uuid;
                callback();
            },
            error: function error() {
                debug("error submitting results");
            }
        });
    }

    /**
     * Gets the current state of the test
     * @returns {String} enum [INIT, PING]
     */
    RMBTTest.prototype.getState = function () {
        return "INIT";
    };

    return RMBTTest;
}();
"use strict";

var curGeoPos;
var geo_callback, loc_timeout;

function runCallback() {
    if (geo_callback != undefined && typeof geo_callback == 'function') {
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
        if (successful === true) {} else {
            //user did not allow geolocation or other reason
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
        }
    }, TestEnvironment.getTestVisualization());
}

//Geolocation tracking
var GeoTracker = function () {
    "use strict";

    var _positions;
    var _clientCallback;
    var _testVisualization = null;

    var _watcher;
    var _firstPositionIsInAccurate;

    function GeoTracker() {
        _positions = [];
        _firstPositionIsInAccurate = false;
    }

    /**
     * Start geolocating
     * @param {Callback(Boolean)} callback expects param 'successful' (boolean, ErrorReason) and
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
                timeout: 2000, //2 seconds
                maximumAge: 60000 //one minute
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

        //call at latest after 2 seconds
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
"use strict";

var TestEnvironment = function () {
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

        init: function init() {
            testVisualization = new TestVisualization();
            geoTracker = new GeoTracker();
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
 *  Constructor expects a object that implements {RMBTIntermediateResult}.getIntermediateResult()
 *      this will be called every xx ms (pull)
 *  The Animation loop will start as soon as "startTest()" is called
 *  The status can be set directly via setStatus or in the intermediateResult
 *  Information (provider, ip, uuid, etc.) has to be set via updateInformation
 *  As soon as the test reaches the "End"-State, the result page is called
 */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var TestVisualization = function () {
    var _imageDirectory = '../img/';

    //static values for the duration of ndt, qos since there is no info from the applet
    var _qosTestDurationMs = 10000;
    var _startTimeQos = -1;

    var _rmbtTest;

    var _noCanvas = false;

    //canvas initialization
    var _canvas1; //progession canvas
    var _canvas2; //upload/download-canvas

    var _ctx1; //context of progression canvas
    var _ctx2; //context of upload/download-canvas

    //dimensions
    var _W;
    var _H;

    //Variables
    var _degrees_status = 0; //current status of the animation
    var _new_degrees_status = 0; //current goal of the animation, volatile to jstest.js
    var _old_degrees_status = 0; //the current goal the animation is trying to achieve
    var _degrees_updwn = 0;
    var _new_degrees_updwn = 0;
    var _difference = 0;

    //var color = "lightgreen"; //green looks better to me
    var _bgcolor = "#2E4653";
    var _text;
    var _animation_loop, _redraw_loop;

    var _image;

    // Create gradients
    var _grad1;
    var _grad2;

    var _infogeo = null;
    var _infoserver = null;
    var _infoip = null;
    var _infostatus = null;
    var _infoprovider = null;
    var _spinner = null;
    var _spinnertarget = null;

    function TestVisualization() {

        //Check if Canvas is supported
        var canvasTurnOff = getParam('nocanvas');
        if (!Modernizr.canvas || canvasTurnOff) {
            _noCanvas = true;
        } else {
            _noCanvas = false;
        }

        //init the canvas
        if (_noCanvas) {
            $("#dashboard").detach();
            $("#dashboard_easy").show();
        } else {
            $("#error_placeholder").hide();
            $("#dashboard").show();
            $("#dashboard_easy").detach();
            initCanvas();
        }
        $("#error_placeholder").hide();
        $("#loading-placeholder").hide();

        _infogeo = document.getElementById("infogeo");
        _infoserver = document.getElementById("infoserver");
        _infoip = document.getElementById("infoip");
        _infostatus = document.getElementById("infostatus");
        _infoprovider = document.getElementById("infoprovider");
        _spinnertarget = document.getElementById("activity-indicator");
    };

    /**
     * Sets the RMBT Test object
     * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
     */
    TestVisualization.prototype.setRMBTTest = function (rmbtTest) {
        _rmbtTest = rmbtTest;
    };

    function progress_segment(status, progress) {
        var ProgressSegmentsTotal = 96;
        var ProgressSegmentsInit = 14;
        var ProgressSegmentsPing = 15;
        var ProgressSegmentsDown = 34;
        var ProgressSegmentsUp = 33;
        var progressValue = 0;
        var progressSegments = 0;
        switch (status) {
            case "INIT":
            case "INIT_DOWN":
                progressSegments = Math.round(ProgressSegmentsInit * progress);
                break;
            case "PING":
                progressSegments = ProgressSegmentsInit + Math.round(ProgressSegmentsPing * progress);
                break;
            case "DOWN":
                progressSegments = ProgressSegmentsInit + ProgressSegmentsPing + Math.round(ProgressSegmentsDown * progress);
                break;
            case "INIT_UP":
                progressSegments = ProgressSegmentsInit + ProgressSegmentsPing + ProgressSegmentsDown;
                break;
            case "UP":
                progressSegments = ProgressSegmentsInit + ProgressSegmentsPing + ProgressSegmentsDown + Math.round(ProgressSegmentsUp * progress);
                progressSegments = Math.min(95, progressSegments);
                break;
            case "END":
                progressSegments = ProgressSegmentsTotal;
                break;
            case "QOS_TEST_RUNNING":
                progressSegments = 95;
                break;
            case TestState.SPEEDTEST_END:
            case TestState.QOS_END:
                progressSegments = 95;
                break;
            case "ERROR":
            case "ABORTED":
                progressSegments = 0;
                break;
        }
        progressValue = progressSegments / ProgressSegmentsTotal;
        return progressValue;
    }

    function initCanvas() {
        // GAUGE VISUALISATION

        //canvas initialization
        _canvas1 = document.getElementById("canvas-progress");
        _canvas2 = document.getElementById("canvas-downup");

        _ctx1 = _canvas1.getContext("2d");
        _ctx2 = _canvas2.getContext("2d");

        //dimensions
        _W = _canvas1.width;
        _H = _canvas1.height;

        _image = new Image();

        // Create gradients
        _grad1 = _ctx1.createRadialGradient(_W / 2, _H / 2, 110, _W / 2, _H / 2, 118);
        _grad1.addColorStop(0.0, 'rgba(200,200,200,1)');
        _grad1.addColorStop(0.3, 'rgba(255,255,255,1)');
        _grad1.addColorStop(0.7, 'rgba(255,255,255,1)');
        _grad1.addColorStop(1.0, 'rgba(200,200,200,1)');

        _grad2 = _ctx2.createRadialGradient(_W / 2, _H / 2, 110, _W / 2, _H / 2, 118);
        _grad2.addColorStop(0.0, 'rgba(50,201,14,1)');
        _grad2.addColorStop(0.3, 'rgba(0,249,61,1)');
        _grad2.addColorStop(0.7, 'rgba(0,249,61,1)');
        _grad2.addColorStop(1.0, 'rgba(50,201,14,1)');
    }

    function resetCanvas() {
        //Clear the canvas everytime a chart is drawn
        _ctx1.clearRect(0, 0, _W, _H);
        _ctx2.clearRect(0, 0, _W, _H);

        //Background 360 degree arc
        _ctx1.beginPath();
        _ctx1.strokeStyle = _bgcolor;
        _ctx1.lineWidth = 35;
        _ctx1.arc(_W / 2, _H / 2, 114, 0 - 150 * Math.PI / 180, Math.PI * 0.66, false);
        //you can see the arc now
        _ctx1.stroke();

        _ctx2.beginPath();
        _ctx2.strokeStyle = _bgcolor;
        _ctx2.lineWidth = 35;
        _ctx2.arc(_W / 2, _H / 2, 114, 0 * Math.PI / 180, Math.PI * 1.7, false);
        //you can see the arc now
        _ctx2.stroke();

        //gauge will be a simple arc
        //Angle in radians = angle in degrees * PI / 180
        var radians1 = _degrees_status * Math.PI / 240;
        var radians2 = _degrees_updwn * Math.PI / 212;

        _ctx1.beginPath();
        _ctx1.strokeStyle = _grad1;
        _ctx1.lineWidth = 18;
        //The arc starts from the rightmost end. If we deduct 90 degrees from the angles
        //the arc will start from the topmost end
        _ctx1.arc(_W / 2, _H / 2, 114, 0 - 150 * Math.PI / 180, radians1 - 150 * Math.PI / 180, false);
        //you can see the arc now
        _ctx1.stroke();

        _ctx2.beginPath();
        _ctx2.strokeStyle = _grad2;
        _ctx2.lineWidth = 18;
        //The arc starts from the rightmost end. If we deduct 90 degrees from the angles
        //the arc will start from the topmost end
        _ctx2.arc(_W / 2, _H / 2, 114, 0 - 0 * Math.PI / 180, radians2 - 0 * Math.PI / 180, false);
        //you can see the arc now
        _ctx2.stroke();

        //Lets add the text
        _ctx1.fillStyle = '#FFF';
        _ctx1.font = "bold 18pt tahoma";
        _text = Math.floor(_degrees_status / 360 * 100) + "%";
        //Lets center the text
        //deducting half of text width from position x
        var text_width = _ctx1.measureText(_text).width;
        //adding manual value to position y since the height of the text cannot
        //be measured easily. There are hacks but we will keep it manual for now.
        _ctx1.fillText(_text, _W / 2 - text_width / 2 + 4, _H / 2 + 7);

        // Down-, Upload Images
        //var image = new Image();
        //image.src = "img/speedtest/download-icon.png";
        if (_image !== null && _image.src !== "") {
            _ctx2.drawImage(_image, _W / 2 - 15, _H / 2 - 24);
        }

        /*
         ctx2.fillStyle = '#FFF';
         ctx2.font = "bold 18pt tahoma";
         text = Math.floor(degrees/360*100) + "";
         //Lets center the text
         //deducting half of text width from position x
         text_width = ctx2.measureText(text).width;
         //adding manual value to position y since the height of the text cannot
         //be measured easily. There are hacks but we will keep it manual for now.
         ctx2.fillText(text, W/2 - text_width/2 + 0, H/2 + 7);
         */
    }

    var _serverName = null;
    var _remoteIp = null;
    var _providerName = null;
    var _testUUID = '';
    TestVisualization.prototype.updateInfo = function (serverName, remoteIp, providerName, testUUID) {
        _serverName = serverName;
        _remoteIp = remoteIp;
        _providerName = providerName;
        _testUUID = testUUID;
    };

    TestVisualization.prototype.setStatus = function (status) {
        set_status(status);
    };

    TestVisualization.prototype.setLocation = function (latitude, longitude) {
        //from Opentest.js
        var formatCoordinate = function formatCoordinate(decimal, label_positive, label_negative) {
            var label = deg < 0 ? label_negative : label_positive;
            var deg = Math.floor(Math.abs(decimal));
            var tmp = Math.abs(decimal) - deg;
            var min = tmp * 60;
            return label + " " + deg + "&deg; " + min.toFixed(3) + "'";
        };

        var ausgabe = document.getElementById("infogeo");
        latitude = formatCoordinate(latitude, Lang.getString('North'), Lang.getString('South'));
        longitude = '<br />' + formatCoordinate(longitude, Lang.getString('East'), Lang.getString('West'));
        ausgabe.innerHTML = latitude + " " + longitude;
    };

    /**
     * Starts the gauge/progress bar
     * and relies on .getIntermediateResult() therefore
     *  (function previously known as draw())
     */
    TestVisualization.prototype.startTest = function () {
        //reset error
        close_errorPopup();

        //first draw, then the timeout should kick in
        draw();
    };

    var lastProgress = -1;
    var lastStatus = -1;
    function draw() {
        var getSignificantDigits = function getSignificantDigits(number) {
            if (number > 100) {
                return -1;
            } else if (number >= 10) {
                return 0;
            } else if (number >= 1) {
                return 1;
            } else if (number >= 0.1) {
                return 2;
            } else {
                return 3;
            }
        };

        var status, ping, down, up, up_log, down_log;
        var progress,
            showup = "-",
            showdown = "-",
            showping = "-";
        var result = _rmbtTest.getIntermediateResult();
        if (result === null || result.progress === lastProgress && lastProgress !== 1 && lastStatus === result.status.toString() && lastStatus !== TestState.QOS_TEST_RUNNING && lastStatus !== TestState.QOS_END && lastStatus !== TestState.SPEEDTEST_END) {
            _redraw_loop = setTimeout(draw, 250);
            return;
        }
        lastProgress = result.progress;
        lastStatus = result.status.toString();

        if (result !== null) {
            down = result.downBitPerSec;
            up = result.upBitPerSec;
            down_log = result.downBitPerSecLog;
            up_log = result.upBitPerSecLog;
            ping = result.pingNano;
            status = result.status.toString();
            progress = result.progress;
            //console.log("down:"+down+" up:"+up+" ping:"+ping+" progress:"+progress+" status:"+status);
        }

        if (_serverName !== undefined && _serverName !== null && _serverName !== '') {
            _infoserver.innerHTML = _serverName;
        }

        if (_remoteIp !== undefined && _remoteIp !== null && _remoteIp !== '') {
            _infoip.innerHTML = _remoteIp;
        }

        if (_providerName !== undefined && _providerName !== null && _providerName !== '') {
            _infoprovider.innerHTML = _providerName;
        }

        //show-Strings
        if (ping > 0) {
            showping = ping / 1000000;
            showping = showping.formatNumber(getSignificantDigits(showping)) + " " + Lang.getString('ms');
        }

        if (down > 0) {
            showdown = down / 1000000;
            showdown = showdown.formatNumber(getSignificantDigits(showdown)) + " " + Lang.getString("Mbps");
        }

        if (up > 0) {
            showup = up / 1000000;
            showup = showup.formatNumber(getSignificantDigits(showup)) + " " + Lang.getString("Mbps");
        }

        var drawCanvas = function drawCanvas() {
            console.log(status + ": " + progress);
            var prog = progress_segment(status, progress);
            //console.log("Prog: "+prog);
            //if (status != 'END' && status != 'ERROR' && status != 'ABORTED') {

            //Cancel any movement animation if a new chart is requested
            if ((typeof _animation_loop === "undefined" ? "undefined" : _typeof(_animation_loop)) !== undefined) clearInterval(_animation_loop);

            //random degree from 0 to 360
            //new_degrees = Math.round(Math.random()*360);
            _new_degrees_status = Math.round(prog * 360) + 1;

            document.getElementById('showPing').innerHTML = showping;
            document.getElementById('showDown').innerHTML = showdown;
            document.getElementById('showUp').innerHTML = showup;

            if (status === "DOWN") {
                if (down_log > 1) down_log = 1;
                _degrees_updwn = Math.round(down_log * 360);
                var imgPath = _imageDirectory + "speedtest/download-icon.png";
                if (_image.src !== imgPath) {
                    _image.src = imgPath;
                }
            } else if (status === "UP") {
                if (up_log > 1) up_log = 1;
                _degrees_updwn = Math.round(up_log * 360);
                var imgPath = _imageDirectory + "speedtest/upload-icon.png";
                if (_image.src !== imgPath) {
                    _image.src = imgPath;
                }
            }
            //console.log("up_log: "+up_log);
            //console.log("degrees_updwn: "+degrees_updwn);
            _difference = Math.max(1, _new_degrees_status - _degrees_status);
            //This will animate the gauge to new positions
            //The animation will take 1 second
            //time for each frame is 1sec / difference in degrees
            _animation_loop = setInterval(animate_to, 500 / _difference);
            //animation_loop = setInterval(animate_to, 10);

        };
        var drawNoCanvas = function drawNoCanvas() {
            var show_prog = progress * 100;
            if (show_prog < 100) show_prog = show_prog.toPrecision(2);else show_prog = 100;
            $('#progbar').css('width', Math.floor(210 + show_prog * 2.1) + 'px');
            var show_prog_tmp = show_prog / 2;
            if (status === TestState.UP) {
                show_prog_tmp += 50;
            }
            if (show_prog_tmp < 100) show_prog_tmp = show_prog_tmp.toPrecision(2);else show_prog_tmp = 100;
            $('#progbar').html(show_prog_tmp + "%");
            $('#activity-indicator').html("(" + show_prog + "%)");
            var ulbar_width = Math.floor(up_log * 420);
            $('#ulbar').css('width', ulbar_width + 'px');
            $('#ulbar').html(showup);
            $("#showUp").html(showup);

            var dlbar_width = Math.floor(down_log * 420);
            $('#dlbar').css('width', dlbar_width + 'px');
            $('#dlbar').html(showdown);
            $('#showDown').html(showdown);
        };
        set_status(status);

        if (_noCanvas) {
            drawNoCanvas();
        } else {
            drawCanvas();
        }

        if (status !== "END" && status !== "ERROR" && status !== "ABORTED") {
            _redraw_loop = setTimeout(draw, 250);
            //Draw a new chart
        } else if (status === "ERROR" || status === "ABORTED") {} else if (status === "END") {

            redirectToTestResult();
        }
        //  }
    }

    /**
     * function to show current status
     * @param {string} curStatus status that will be displayed
     * @returns {undefined}
     */
    function set_status(curStatus) {
        if (_spinner !== null) {
            _spinner.stop();
            _spinner = null;
        }

        switch (curStatus) {
            case TestState.LOCATE:
                _infostatus.innerHTML = Lang.getString('Locating');
                var opts = {
                    lines: 7,
                    length: 0,
                    width: 3,
                    radius: 2,
                    trail: 50,
                    speed: 1.2,
                    color: "#002D45"
                };
                _spinner = new Spinner(opts).spin(_spinnertarget);
                break;
            case TestState.INIT:
            case TestState.INIT_DOWN:
                _infostatus.innerHTML = Lang.getString('Initializing');
                break;
            case TestState.WAIT:
                _infostatus.innerHTML = Lang.getString('WaitForSlot');
                break;
            case TestState.INIT_UP:
                _infostatus.innerHTML = Lang.getString('Init_Upload');
                break;
            case TestState.PING:
                _infostatus.innerHTML = Lang.getString("Ping");
                break;
            case TestState.DOWN:
                _infostatus.innerHTML = Lang.getString("Download");
                break;
            case TestState.UP:
                _infostatus.innerHTML = Lang.getString("Upload");
                break;
            case TestState.QOS_TEST_RUNNING:
                //guess duration here since there is no information from the applet
                if (_startTimeQos < 0) {
                    _startTimeQos = new Date().getTime();
                }
                var now = new Date().getTime();
                var progress = Math.min(1, (now - _startTimeQos) / _qosTestDurationMs);

                _infostatus.innerHTML = Lang.getString('QosTest') + " (" + Math.round(progress * 100) + "&nbsp;%)";
                break;
            case TestState.QOS_END:
            case TestState.SPEEDTEST_END:
                //this could be the NDT test running
                if (_rmbtTest.getNdtStatus() !== null && _rmbtTest.getNdtStatus().toString() === "RUNNING") {
                    var progress = _rmbtTest.getNdtProgress();
                    _infostatus.innerHTML = Lang.getString('NDT') + " (" + Math.round(progress * 100) + "&nbsp;%)";
                }

                break;
            case TestState.END:
                _infostatus.innerHTML = Lang.getString('Finished');
                break;
            case TestState.ERROR:
                _infostatus.innerHTML = Lang.getString('Error');
                $("#popuperror").empty();
                $("#popuperror").append('<p>' + Lang.getString('ErrorOccuredDuringTest') + '</p>');
                if (lastStatus !== curStatus) {
                    show_errorPopup();
                    lastStatus = curStatus;
                }
                break;
            case TestState.ABORTED:
                _infostatus.innerHTML = Lang.getString('Aborted');
                $("#popuperror").empty();
                $("#popuperror").append('<p>' + Lang.getString('PrematureEnd') + '</p>');
                show_errorPopup();
                break;
            case "JAVAERROR":
                _infostatus.innerHTML = Lang.getString('Aborted');
                $("#popuperror").empty();
                $("#popuperror").append('<p>' + Lang.getString('AppletCouldNotBeLoaded') + '</p>');
                show_errorPopup();
                break;
            case TestState.LOCABORTED:
                _infostatus.innerHTML = Lang.getString('Init_applet');
                if (!noJava) start_test();else start_jstest();
                break;
            default:
                console.log("Unknown test state: " + curStatus);
        }
    }

    function redirectToTestResult() {
        var forwardUrl = "/" + selectedLanguage + "/Verlauf";
        if (preferredTest === TestTypes.Java || getParam("Java")) {
            forwardUrl += "?Java=True";
        }
        forwardUrl += "#";
        forwardUrl += _testUUID;
        setTimeout(function () {
            window.location.href = forwardUrl;
        }, 2000);
    }

    /**
     * function to make the chart move to new degrees
     * (one degree at a time)
     * is called by interval declared in animation_loop
     * by speedtest-components (Downloadtest, Uploadtest)
     */
    function animate_to() {
        //clear animation loop if degrees reaches to new_degrees
        if (_degrees_status >= _new_degrees_status) clearInterval(_animation_loop);

        if (_degrees_status < _new_degrees_status) {
            _degrees_status++;
        }

        //if the new degrees status is different from the old one
        //move the degrees_status forward to the old one so that
        //animation does not hang
        if (_old_degrees_status !== _new_degrees_status) {
            _degrees_status = _old_degrees_status;
            _old_degrees_status = _new_degrees_status;
        }

        resetCanvas();
    }

    return TestVisualization;
}();
"use strict";

function RMBTTestConfig() {}
RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
RMBTTestConfig.prototype.language = selectedLanguage;
RMBTTestConfig.prototype.uuid = "";
RMBTTestConfig.prototype.type = "DESKTOP";
RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
RMBTTestConfig.prototype.client_software_version = "0.6.3";
RMBTTestConfig.prototype.os_version = 1;
RMBTTestConfig.prototype.platform = "RMBTws";
RMBTTestConfig.prototype.model = "Websocket";
RMBTTestConfig.prototype.product = "Chrome";
RMBTTestConfig.prototype.client = "RMBTws";
RMBTTestConfig.prototype.timezone = "Europe/Vienna"; //@TODO
RMBTTestConfig.prototype.controlServerURL = controlProxy + "/" + wspath;
RMBTTestConfig.prototype.controlServerRegistrationResource = "/testRequest";
RMBTTestConfig.prototype.controlServerResultResource = "/result";
RMBTTestConfig.prototype.controlServerDataCollectorResource = "/requestDataCollector";
//?!? - from RMBTTestParameter.java
RMBTTestConfig.prototype.pretestDurationMs = 2000;
RMBTTestConfig.prototype.savedChunks = 4; //4*4 + 4*8 + 4*16 + ... + 4*MAX_CHUNK_SIZE -> O(8*MAX_CHUNK_SIZE)
RMBTTestConfig.prototype.measurementPointsTimespan = 40; //1 measure point every 40 ms
RMBTTestConfig.prototype.numPings = 10; //do 10 pings
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
}();

/**
 * Control structure for a single websocket-test thread
 * @param {CyclicBarrier} cyclicBarrier
 * @returns {RMBTTestThread}
 */
function RMBTTestThread(cyclicBarrier) {
    var debug = function debug(text) {
        //return; //no debug
        $("#debug").prepend(text + "\n");
        console.log(text);
    };

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
            debug(this.id + ": reached state: " + state);
            var that = this;
            _cyclicBarrier.await(function () {
                debug(that.id + ": all threads reached state: " + state);
                if (_callbacks[state] !== undefined && _callbacks[state] !== null) {
                    var callback = _callbacks[state];
                    //_callbacks[state] = null;
                    callback();
                } else {
                    debug(that.id + ": no callback registered");
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
            var states = [TestState.INIT, TestState.INIT_DOWN, TestState.PING, TestState.DOWN, TestState.INIT_UP, TestState.UP, TestState.END];
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

function RMBTTestResult() {
    this.pings = [];
    this.speedItems = [];
    this.threads = [];
}
RMBTTestResult.prototype.addThread = function (rmbtThreadTestResult) {
    this.threads.push(rmbtThreadTestResult);
};
RMBTTestResult.prototype.ip_local;
RMBTTestResult.prototype.ip_server;
RMBTTestResult.prototype.port_remote;
RMBTTestResult.prototype.num_threads;
RMBTTestResult.prototype.encryption = "NONE";
RMBTTestResult.prototype.ping_shortest = -1;
RMBTTestResult.prototype.ping_median = -1;
RMBTTestResult.prototype.client_version;
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

    for (var i = 0; i < numThreads; i++) {
        var thread = threads[i];
        if (thread !== null && phaseResults(thread).length > 0) {
            var targetIdx = phaseResults(thread).length;
            for (var j = 0; j < phaseResults(thread).length; j++) {
                if (phaseResults(thread)[j].duration > targetTime) {
                    targetIdx = j;
                    break;
                }
            }
            var calcBytes;
            if (targetIdx === phaseResults(thread).length) {
                // nsec[max] == targetTime
                calcBytes = phaseResults(thread)[phaseResults(thread).length - 1].bytes;
            } else {
                var bytes1 = targetIdx === 0 ? 0 : phaseResults(thread)[targetIdx - 1].bytes;
                var bytes2 = phaseResults(thread)[targetIdx].bytes;
                var bytesDiff = bytes2 - bytes1;
                var nsec1 = targetIdx === 0 ? 0 : phaseResults(thread)[targetIdx - 1].duration;
                var nsec2 = phaseResults(thread)[targetIdx].duration;
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
    for (var i = 0; i < this.threads.length; i++) {
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
    var results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(this.threads, function (thread) {
        return thread.up;
    });
    this.speed_upload = results.speed / 1e3; //bps -> kbps
    this.bytes_upload = results.bytes;
    this.nsec_upload = results.nsec;

    //ping
    var pings = this.threads[0].pings;
    var shortest = Infinity;
    for (var i = 0; i < pings.length; i++) {
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
    this.down = []; //map of bytes/nsec
    this.up = [];
    this.pings = [];
}
//no inheritance(other than in Java RMBTClient)
//RMBTThreadTestResult.prototype = new RMBTTestResult();
RMBTThreadTestResult.prototype.down;
RMBTThreadTestResult.prototype.up;
RMBTThreadTestResult.prototype.pings;
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
    CONNECT_FAILED: "connecting to test server failed"
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

function nowNs() {
    return Math.round(window.performance.now() * 1e6); //from ms to ns
}

//Cyclic Barrier (Java: http://docs.oracle.com/javase/7/docs/api/java/util/concurrent/CyclicBarrier.html )
var CyclicBarrier = function () {
    "use strict";

    var _parties;
    var _callbacks = [];

    /**
     * Creates a new cyclic barrier
     * @param {Integer} parties the number of threads that must invoke await()
     *      before the barrier is tripped
     */
    function CyclicBarrier(parties) {
        _parties = parties;
    }

    /**
     * Waits until all parties have invoked await on this barrier
     * The current context is disabled in any case.
     *
     * As soon as all threads have called 'await', all callbacks will
     * be executed
     * @param {Function} callback
     */
    CyclicBarrier.prototype.await = function (callback) {
        _callbacks.push(callback);
        if (_callbacks.length === _parties) {
            release();
        }
    };

    function release() {
        //first, copy and clear callbacks
        //to prohibit that a callback registers before all others are released
        var tmp = _callbacks.slice();
        _callbacks = [];

        for (var i = 0; i < _parties; i++) {
            //prevent side effects in last function that called "await"
            window.setTimeout(tmp[i], 1);
        }
    }

    return CyclicBarrier;
}();

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