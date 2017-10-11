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

/**
 * RMBTTest main object
 * @param {RMBTTestConfig} rmbtTestConfig
 * @param {RMBTControlServerCommunication} rmbtControlServer
 * @returns {}
 */
function RMBTTest(rmbtTestConfig, rmbtControlServer) {
    const _server_override = "wss://developv4-rmbtws.netztest.at:19002";

    let _logger = log.getLogger("rmbtws");

    let _chunkSize=null;
    let MAX_CHUNK_SIZE=4194304;
    let MIN_CHUNK_SIZE=0;
    let DEFAULT_CHUNK_SIZE=4096;
    let _changeChunkSizes=false;

    /**
     *  @type {RMBTTestConfig}
     **/
    let _rmbtTestConfig;

    /**
     * @type {RMBTControlServerCommunication}
     */
    let _rmbtControlServer;
    let _rmbtTestResult=null;
    let _errorCallback=null;
    let _stateChangeCallback=null;

    let _state=TestState.INIT;
    let _stateChangeMs=null;
    const _statesInfo = {
        durationInitMs: 2500,
        durationPingMs: 10000, //set dynamically
        durationUpMs: -1,
        durationDownMs: -1
    };

    let _intermediateResult=new RMBTIntermediateResult();

    let _threads=[];
    let _arrayBuffers={};
    let _endArrayBuffers={};

    let _cyclicBarrier=null;
    let _numThreadsAllowed=0;
    let _numDownloadThreads=0;
    let _numUploadThreads=0;

    let _bytesPerSecsPretest=[];
    let _totalBytesPerSecsPretest=0;

    //this is an observable/subject
    //http://addyosmani.com/resources/essentialjsdesignpatterns/book/#observerpatternjavascript
    //RMBTTest.prototype = new Subject();


    function construct(rmbtTestConfig, rmbtControlServer) {
        //init socket
        _rmbtTestConfig = rmbtTestConfig;// = new RMBTTestConfig();
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
    this.onError = function(fct)  {
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
    const callErrorCallback = function(error) {
        _logger.debug("error occurred during websocket test:", error);
        if (error !== RMBTError.NOT_SUPPORTED) {
            setState(TestState.ERROR);
        }
        if (_errorCallback !== null) {
            let t = _errorCallback;
            _errorCallback = null;
            t(error);
        }
    };

    this.startTest = function() {
        //see if websockets are supported
        if (window.WebSocket === undefined)  {
            callErrorCallback(RMBTError.NOT_SUPPORTED);
            return;
        }

        setState(TestState.INIT);
        _rmbtTestResult = new RMBTTestResult();
        //connect to control server
        _rmbtControlServer.getDataCollectorInfo();

        _rmbtControlServer.obtainControlServerRegistration(function(response) {
            _numThreadsAllowed = parseInt(response.test_numthreads);
            _cyclicBarrier = new CyclicBarrier(_numThreadsAllowed);
            _statesInfo.durationDownMs = response.test_duration * 1e3;
            _statesInfo.durationUpMs = response.test_duration * 1e3;

            //@TODO: Nicer
            //if there is testVisualization, make use of it!
            if (TestEnvironment.getTestVisualization() !== null) {
                    TestEnvironment.getTestVisualization().updateInfo(
                        response.test_server_name,
                        response.client_remote_ip,
                        response.provider,
                        response.test_uuid
                    );
            }

            const continuation = function() {
                _logger.debug("got geolocation, obtaining token and websocket address");

                //wait if we have to
                const continuation = () => {
                    setState(TestState.INIT);
                    _rmbtTestResult.beginTime = Date.now();
                    //n threads
                    for (let i = 0; i < _numThreadsAllowed; i++) {
                        let thread = new RMBTTestThread(_cyclicBarrier);
                        thread.id = i;
                        _rmbtTestResult.addThread(thread.result);

                        //only one thread will call after upload is finished
                        conductTest(response, thread, function () {
                            _logger.info("All tests finished");
                            wsGeoTracker.stop();
                            _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
                            _rmbtTestResult.calculateAll();
                            _rmbtControlServer.submitResults(
                                prepareResult(response),
                                () => {
                                    setState(TestState.END);
                                },
                                () => {
                                    callErrorCallback(RMBTError.SUBMIT_FAILED);
                                }
                            );
                        });

                        _threads.push(thread);
                    }
                };

                if (response.test_wait === 0) {
                    continuation();
                }
                else {
                    _logger.info("test scheduled for start in " + response.test_wait + " second(s)");
                    setState(TestState.WAIT);
                    self.setTimeout(function () {
                        continuation();
                    }, response.test_wait * 1e3);
                }

            };

            let wsGeoTracker;
            //get the user's geolocation
            if (TestEnvironment.getGeoTracker() !== null) {
                wsGeoTracker = TestEnvironment.getGeoTracker();

                //in case of legacy code, the geoTracker will already be started
                continuation();
            } else {
                wsGeoTracker = new GeoTracker();
                _logger.debug("getting geolocation");
                wsGeoTracker.start(function() {
                    continuation();
                }, TestEnvironment.getTestVisualization());
            }
        }, () => {
            //no internet connection
            callErrorCallback(RMBTError.REGISTRATION_FAILED);
        });
    };

    /**
     *
     * @returns {RMBTIntermediateResult}
     */
    this.getIntermediateResult = function() {
        _intermediateResult.status = _state;
        let diffTime = (nowNs() / 1e6) - _stateChangeMs;

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
            }

            if (_intermediateResult.status === TestState.DOWN || _intermediateResult.status == TestState.INIT_UP) {
                let results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.down;
                });

                _intermediateResult.downBitPerSec = results.speed;
                _intermediateResult.downBitPerSecLog = (Math.log10(_intermediateResult.downBitPerSec / 1e6) + 2) / 4;
            }

            if (_intermediateResult.status === TestState.UP || _intermediateResult.status == TestState.INIT_UP) {
                let results = RMBTTestResult.calculateOverallSpeedFromMultipleThreads(_rmbtTestResult.threads, function (thread) {
                    return thread.up;
                });

                _intermediateResult.upBitPerSec = results.speed;
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
        let server = ((registrationResponse.test_server_encryption) ? "wss://" : "ws://") +
                registrationResponse.test_server_address + ":" + registrationResponse.test_server_port;
        //server = server_override;
        _logger.debug(server);

        const errorFunctions = function() {
            return {
                IGNORE : function() {
                    //ignore error :)
                },
                CALLGLOBALHANDLER : function(e) {
                    if (e) {
                        _logger.error("connection closed", e);
                    }
                    callErrorCallback(RMBTError.CONNECT_FAILED);
                },
                TRYRECONNECT : function() {
                    //@TODO: try to reconnect
                    //@TODO: somehow restart the current phase
                    callErrorCallback(RMBTError.CONNECT_FAILED);
                }
            }
        }();

        //register state enter events
        thread.onStateEnter(TestState.INIT_DOWN, function() {
            setState(TestState.INIT_DOWN);
            _logger.debug(thread.id + ": start short download");
            _chunkSize = MIN_CHUNK_SIZE;

            //all threads download, according to specification
            shortDownloadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.PING, function() {
            setState(TestState.PING);
            _logger.debug(thread.id + ": starting ping");
            //only one thread pings
            if (thread.id === 0) {
                pingTest(thread);
            } else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.DOWN, function() {
            setState(TestState.DOWN);

            //set threads and chunksize
            if (_bytesPerSecsPretest.length > 0) {
                let chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.downloadThreadsLimitsMbit, false);
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
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.INIT_UP, function() {
            setState(TestState.INIT_UP);
            _chunkSize = MIN_CHUNK_SIZE;

            shortUploadtest(thread, _rmbtTestConfig.pretestDurationMs);
        });

        thread.onStateEnter(TestState.UP, function() {
            setState(TestState.UP);

            //set threads and chunksize
            if (_bytesPerSecsPretest.length > 0) {
                let chunkSizes = calculateChunkSizes(_bytesPerSecsPretest, _rmbtTestConfig.uploadThreadsLimitsMbit, true);
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

        thread.onStateEnter(TestState.END, function() {
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
        connectToServer(thread,server,registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
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
        } catch(e) {
            callErrorCallback(RMBTError.SOCKET_INIT_FAILED);
            return;
        }

        thread.socket.binaryType = "arraybuffer";
        thread.socket.onerror = errorHandler;
        thread.socket.onclose = errorHandler;

        thread.socket.onmessage = function(event) {
            //logger.debug("thread " + thread.id + " triggered, state " + thread.state + " event: " + event);

            //console.log(thread.id + ": Received: " + event.data);
            if (event.data.indexOf("CHUNKSIZE") === 0) {
                let parts = event.data.trim().split(" ");
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
                _logger.debug(thread.id + ": Chunksizes: min " + MIN_CHUNK_SIZE +
                    ", max: " + MAX_CHUNK_SIZE +
                    ", default: " + DEFAULT_CHUNK_SIZE);
            } else if (event.data.indexOf("RMBTv") === 0) {
                //get server version
                let version = event.data.substring(5).trim();
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
        _totalBytesPerSecsPretest = bytesPerSecsPretest.reduce((acc, val) => acc + val);

        _logger.debug("total: circa " + _totalBytesPerSecsPretest / 1000 + " KB/sec");
        _logger.debug("total: circa " + _totalBytesPerSecsPretest * 8 / 1e6 + " MBit/sec");

        //set number of upload threads according to mbit/s measured
        let mbits = _totalBytesPerSecsPretest * 8 / 1e6;
        let threads = 0;
        Object.keys(threadLimits).forEach((thresholdMbit) => {
            if (mbits > thresholdMbit) {
                threads = threadLimits[thresholdMbit];
            }
        });
        threads = Math.min(_numThreadsAllowed, threads);
        _logger.debug("set number of threads to be used in upcoming speed test to: " + threads);

        //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
        let calculatedChunkSize = _totalBytesPerSecsPretest / (1000 / ((_rmbtTestConfig.measurementPointsTimespan / 2)));

        //round to the nearest full KB
        calculatedChunkSize -= calculatedChunkSize % 1024;

        //but min 4KiB
        calculatedChunkSize = Math.max(MIN_CHUNK_SIZE, calculatedChunkSize);

        //and max MAX_CHUNKSIZE
        calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);

        _logger.debug("calculated chunksize for upcoming speed test " + calculatedChunkSize / 1024 + " KB");

        if (limitToExistingChunks) {
            //get closest chunk size where there are saved chunks available
            let closest = Number.POSITIVE_INFINITY;
            Object.keys(_arrayBuffers).forEach((key) => {
                let diff = Math.abs(calculatedChunkSize - key);
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
        let prevListener = thread.socket.onmessage;
        let startTime = nowMs(); //ms since page load
        let n = 1;
        let bytesReceived = 0;
        let chunksize = _chunkSize;

        const loop = function() {
            downloadChunks(thread, n, chunksize, function(msg) {
                bytesReceived += n * chunksize;
                _logger.debug(thread.id + ": " + msg);
                let timeNs = parseInt(msg.substring(5));

                let now = nowMs();
                if ((now - startTime) > durationMs) {
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
        let socket = thread.socket;
        let remainingChunks = total;
        let expectBytes = _chunkSize * total;
        let totalRead = 0;
        let lastBuffer = null;

        // https://stackoverflow.com/questions/33702838/how-to-append-bytes-multi-bytes-and-buffer-to-arraybuffer-in-javascript
        const concatBuffer = function (a, b) {
            let c = new Uint8Array(a.length + b.length);
            c.set(a, 0);
            c.set(b, a.length);
            return c;
        };

        const downloadChunkListener = function(event) {
            if (typeof event.data === 'string') {
                return;
            }

            let fullChunk = false;

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
                    let infomsg = line.data;
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
        _logger.debug(thread.id + ": downloading " + total + " chunks, " + (expectBytes / 1000) + " KB");
        let send = "GETCHUNKS " + total +  ((chunkSize !== DEFAULT_CHUNK_SIZE)? " " + chunkSize : "") + "\n";
        socket.send(send);
    }

    function pingTest(thread) {
        let prevListener = thread.socket.onmessage;
        let pingsRemaining = _rmbtTestConfig.numPings;

        const onsuccess = function(pingResult) {
            thread.result.pings.push(pingResult);

            //use first two pings to do a better approximation of the remaining time
            if (pingsRemaining === (_rmbtTestConfig.numPings - 1)) {
                //PING -> PONG -> OK -> TIME -> ACCEPT ... -> PING -> ...
                _statesInfo.durationPingMs = (thread.result.pings[1].timeNs - thread.result.pings[0].timeNs) / 1e6 * _rmbtTestConfig.numPings;
                _logger.debug(thread.id + ": PING phase will take approx " + _statesInfo.durationPingMs + " ms");
            }

            _logger.debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");

            pingsRemaining--;

            if (pingsRemaining > 0) {
                //wait for new 'ACCEPT'-message
                thread.socket.onmessage = function(event) {
                    if (event.data === "ACCEPT GETCHUNKS GETTIME PUT PUTNORESULT PING QUIT\n") {
                        ping(thread, onsuccess);
                    } else {
                        _logger.error("unexpected error during ping test")
                    }
                };
            } else {
                //"break

                //median ping
                let tArrayClient = [];
                for (let i = 0; i < thread.result.pings.length; i++) {
                    tArrayClient.push(thread.result.pings[i].client);
                }
                _rmbtTestResult.ping_client_median = Math.median(tArrayClient);
                _rmbtTestResult.ping_client_shortest = Math.min.apply(Math, tArrayClient);

                let tArrayServer = [];
                for (let i = 0; i < thread.result.pings.length; i++) {
                    tArrayServer.push(thread.result.pings[i].server);
                }

                _rmbtTestResult.ping_server_median = Math.median(tArrayServer);
                _rmbtTestResult.ping_server_shortest = Math.min.apply(Math, tArrayServer);

                _logger.debug(thread.id + ": median client: " + Math.round(_rmbtTestResult.ping_client_median / 1e3) / 1e3 + " ms; " +
                    "median server: " + Math.round(_rmbtTestResult.ping_server_median / 1e3) / 1e3 + " ms");
                _logger.debug(thread.id + ": shortest client: " + Math.round(_rmbtTestResult.ping_client_shortest / 1e3) / 1e3 + " ms; " +
                    "shortest server: " + Math.round(_rmbtTestResult.ping_server_shortest / 1e3) / 1e3 + " ms");

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
        let begin;
        let clientDuration;
        const pingListener = function(event) {
            if (event.data === "PONG\n") {
                let end = nowNs();
                clientDuration = end - begin;
                thread.socket.send("OK\n");
            }
            else if (event.data.indexOf("TIME") === 0) {
                let result = new RMBTPingResult();
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
        let previousListener = thread.socket.onmessage;
        let totalRead = 0;
        let readChunks = 0;
        let lastReportedChunks = -1;

        let interval;
        let lastRead;
        let lastChunk = null;
        let lastTime = null;

        //read chunk only at some point in the future to save resources
        interval = window.setInterval(function() {
            if (lastChunk === null) {
                return;
            }

            //nothing new happened, do not simulate an accuracy that does not exist
            if (lastReportedChunks === readChunks) {
                return;
            }
            lastReportedChunks = readChunks;

            let now = nowNs();
            _logger.debug(thread.id + ": " + lastRead + "|" + _rmbtTestConfig.measurementPointsTimespan + "|" + now + "|" + readChunks);

            let lastByte = new Uint8Array(lastChunk, lastChunk.byteLength - 1, 1);

            //add result
            let duration = lastTime - start;
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

        let downloadListener = function(event) {
            readChunks++;
            totalRead += event.data.byteLength; //arrayBuffer
            lastTime = nowNs();

            lastChunk = event.data;
        };

        thread.socket.onmessage = downloadListener;

        let start = nowNs();
        thread.socket.send("GETTIME " + duration + ((_chunkSize !== DEFAULT_CHUNK_SIZE) ? " " + _chunkSize : "") + "\n");
    }

     /**
     * conduct the short pretest to recognize if the connection
     * is too slow for multiple threads
     * @param {RMBTTestThread} thread
     * @param {Number} durationMs
     */
    function shortUploadtest(thread, durationMs) {
        let prevListener = thread.socket.onmessage;
        let startTime = nowMs(); //ms since page load
        let n = 1;
        let bytesSent = 0;
        let chunkSize = _chunkSize;

        window.setTimeout(function() {
             let endTime = nowMs();
             let duration = endTime - startTime;
             _logger.debug("diff:" + (duration - durationMs) + " (" + (duration-durationMs)/durationMs + " %)");
        }, durationMs);

        let loop = function() {
            uploadChunks(thread, n, chunkSize, function(msg) {
                bytesSent += n * chunkSize;
                _logger.debug(thread.id + ": " + msg);

                let now = nowMs();
                if ((now - startTime) > durationMs) {
                    //"break"
                    thread.socket.onmessage = prevListener;

                    let timeNs = parseInt(msg.substring(5)); //1e9

                    //save circa result
                    _bytesPerSecsPretest.push((n * chunkSize) / (timeNs / 1e9));
                } else {
                    //increase chunk size only if there are saved chunks for it!
                    let newChunkSize = chunkSize * 2;
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
        let socket = thread.socket;

        socket.onmessage = function(event) {
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

        _logger.debug(thread.id + ": uploading " + total + " chunks, " + ((chunkSize * total) / 1000) + " KB");
        socket.send("PUTNORESULT" + ((_changeChunkSizes) ? " " + chunkSize : "") + "\n"); //Put no result
        for (let i = 0; i < total; i++) {
            let blob;
            if (i === (total - 1)) {
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
        let previousListener = thread.socket.onmessage;

        //if less than approx half a second is left in the buffer - resend!
        const fixedUnderrunBytesVisible = (_totalBytesPerSecsPretest / 2) / _numUploadThreads;
        //if less than approx 1.5 seconds is left in the buffer - resend! (since browser limit setTimeout-intervals
        //  when pages are not in the foreground)
        const fixedUnderrunBytesHidden = (_totalBytesPerSecsPretest * 1.5) / _numUploadThreads;
        let fixedUnderrunBytes = (document.hidden) ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;

        const visibilityChangeEventListener = () => {
            fixedUnderrunBytes = (document.hidden) ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;
            _logger.debug("document visibility changed to: " + document.hidden);
        };
        document.addEventListener("visibilitychange",visibilityChangeEventListener);

        //send data for approx one second at once
        //@TODO adapt with changing connection speeds
        const sendAtOnceChunks = Math.ceil((_totalBytesPerSecsPretest / _numUploadThreads) / _chunkSize);

        let receivedEndTime = false;
        let keepSendingData = true;

        let lastDurationInfo = -1;
        let timeoutExtensionsMs = 0;

        let timeoutFunction = function () {
            if (!receivedEndTime) {
                //check how far we are in
                _logger.debug(thread.id + ": is 7.2 sec in, got data for " + lastDurationInfo);
                //if measurements are for < 7sec, give it time
                if ((lastDurationInfo < duration * 1e9) && (timeoutExtensionsMs < 3000)) {
                    window.setTimeout(timeoutFunction, 250);
                    timeoutExtensionsMs += 250;
                } else {
                    //kill it with force!
                    _logger.debug(thread.id + ": didn't finish, timeout extended by " + timeoutExtensionsMs + " ms, last info for " + lastDurationInfo);
                    thread.socket.onerror = () => {};
                    thread.socket.onclose = () => {};

                    //do nothing, we kill it on purpose
                    thread.socket.close();
                    thread.socket.onmessage = previousListener;
                    _logger.debug(thread.id + ": socket now closed: " + thread.socket.readyState);
                    document.removeEventListener("visibilitychange",visibilityChangeEventListener);
                    thread.triggerNextState();
                }
            }
        };

        /**
         * The upload function for a few chunks at a time, encoded as a callback instead of a loop.
         * https://github.com/ndt-project/ndt/blob/master/HTML5-frontend/ndt-browser-client.js
         */
        const sendChunks = () => {
            // Monitor the buffersize as it sends and refill if it gets too low.
            if (thread.socket.bufferedAmount < fixedUnderrunBytes) {
                //logger.debug(thread.id + ": buffer underrun");
                for (let i = 0; i < sendAtOnceChunks; i++) {
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
        window.setTimeout(timeoutFunction, (duration * 1e3) + 200);

        //send end blob after 7s, quit
        window.setTimeout(() => {
            keepSendingData = false;
            thread.socket.onclose = () => {};
            thread.socket.send(_endArrayBuffers[_chunkSize]);
            thread.socket.send("QUIT\n");
        }, duration * 1e3);


        _logger.debug(thread.id + ": set timeout");

        // ms -> ns
        const timespan = _rmbtTestConfig.measurementPointsTimespan * 1e6;
        const pattern = /TIME (\d+) BYTES (\d+)/;
        const patternEnd = /TIME (\d+)/;
        const uploadListener = function(event) {
            //start conducting the test
            if (event.data === "OK\n") {
                sendChunks();
            }

            //intermediate result - save it!
            //TIME 6978414829 BYTES 5738496
            //logger.debug(thread.id + ": rec: " + event.data);
            let matches = pattern.exec(event.data);
            if (matches !== null) {
                const data = {
                    duration: parseInt(matches[1]),
                    bytes: parseInt(matches[2])
                };
                if ((data.duration - lastDurationInfo) > timespan) {
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
                    document.removeEventListener("visibilitychange",visibilityChangeEventListener);
                }
            }
        };
        thread.socket.onmessage = uploadListener;

        thread.socket.send("PUT" + ((_chunkSize !== DEFAULT_CHUNK_SIZE) ? " " + _chunkSize : "") + "\n");
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
            timezone: "Europe/Vienna",
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
    this.getState = function() {
        return "INIT";
    };

    construct(rmbtTestConfig, rmbtControlServer);
};
