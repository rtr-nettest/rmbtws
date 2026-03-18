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
export function RMBTTest(rmbtTestConfig, rmbtControlServer) {
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
        if (globalThis.WebSocket === undefined)  {
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
                        response.test_uuid,
                        response.open_test_uuid,
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
                            if (TestEnvironment.getTestVisualization().getGeoResults) {
                                _rmbtTestResult.geoLocations = TestEnvironment.getTestVisualization().getGeoResults();
                            } else {
                                _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
                            }
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
                _intermediateResult.pings = _rmbtTestResult.pings;
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
            connectToServer(thread,server,registrationResponse.test_token, errorFunctions.CALLGLOBALHANDLER);
        });

        thread.onStateEnter(TestState.INIT_UP, function() {
            //setState(TestState.INIT_UP);
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
        let startTime = performance.now();

        const onsuccess = function(pingResult) {
            thread.result.pings.push(pingResult);
            _rmbtTestResult.pings = [...thread.result.pings];

            //use first two pings to do a better approximation of the remaining time
            if (pingsRemaining === (_rmbtTestConfig.numPings - 1)) {
                //PING -> PONG -> OK -> TIME -> ACCEPT ... -> PING -> ...
                _statesInfo.durationPingMs = (thread.result.pings[1].timeNs - thread.result.pings[0].timeNs) / 1e6 * _rmbtTestConfig.numPings;
                _logger.debug(thread.id + ": PING phase will take approx " + _statesInfo.durationPingMs + " ms");
            }

            _logger.debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");

            pingsRemaining--;

            //at least one, if we want to repeat ping for a certain interval
            if (_rmbtTestConfig.doPingIntervalMilliseconds > 0 && pingsRemaining === 0) {
                let currentTime = performance.now();
                if (currentTime - startTime < _rmbtTestConfig.doPingIntervalMilliseconds) {
                    pingsRemaining = 1;
                }
            }

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
        interval = setInterval(function() {
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
                clearInterval(interval);

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

        setTimeout(function() {
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
        let fixedUnderrunBytes = (globalThis.document && globalThis.document.hidden) ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;

        const visibilityChangeEventListener = () => {
            fixedUnderrunBytes = (globalThis.document && globalThis.document.hidden) ? fixedUnderrunBytesHidden : fixedUnderrunBytesVisible;
            globalThis.document && _logger.debug("document visibility changed to: " + globalThis.document.hidden);
        };
        globalThis.document && globalThis.document.addEventListener("visibilitychange",visibilityChangeEventListener);

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
                    setTimeout(timeoutFunction, 250);
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
                    globalThis.document && document.removeEventListener("visibilitychange",visibilityChangeEventListener);
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
        setTimeout(timeoutFunction, (duration * 1e3) + 200);

        //send end blob after 7s, quit
        setTimeout(() => {
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
                    globalThis.document && document.removeEventListener("visibilitychange",visibilityChangeEventListener);
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
    this.getState = function() {
        return "INIT";
    };

    construct(rmbtTestConfig, rmbtControlServer);
};


"use strict";

let curGeoPos;
let geo_callback, loc_timeout;


function runCallback() {
	if (geo_callback != undefined && typeof geo_callback === 'function') {
		setTimeout(function() {
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
    const ausgabe = globalThis.document && globalThis.document.getElementById("infogeo");
    geo_callback = callback;

    if (!navigator.geolocation) {
        //maybe there is a position in a cookie
        //because the user had been asked for his address
        let coords = getCookie('coords');
        if (coords) {
            let tmpcoords = JSON.parse(coords);
            if (tmpcoords && tmpcoords['lat'] > 0 && tmpcoords['long'] > 0) {
                testVisualization.setLocation(tmpcoords['lat'], tmpcoords['long']);
            }
        } else if (ausgabe) {
            ausgabe.innerHTML = Lang.getString('NotSupported');
        }

        runCallback();
        return;
    }
    runCallback();
    //var TestEnvironment.getGeoTracker() = new GeoTracker();
    TestEnvironment.getGeoTracker().start(function(successful, error) {
        if (successful !== true && ausgabe) {
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
            }
            else {
                //Internet Explorer 11 in some cases does not return an error code
                ausgabe.innerHTML = Lang.getString('NotAvailable');
            }
        }
    }, TestEnvironment.getTestVisualization());
}


//Geolocation tracking
export const GeoTracker = (function() {
    "use strict";

    const _errorTimeout = 2e3; //2 seconds error timeout
    const _maxAge = 60e3; //up to one minute old - don't do geoposition again

    let _positions;
    let _clientCallback;
    let _testVisualization = null;

    let _watcher;
    let _firstPositionIsInAccurate;

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
    GeoTracker.prototype.start = function(callback, testVisualization) {
        _clientCallback = callback;

        if (testVisualization !== undefined) {
            _testVisualization = testVisualization;
        }

        if (navigator.geolocation) {
            //try to get an rough first position
            navigator.geolocation.getCurrentPosition(function(success) {
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
        }
        else {
            let t = _clientCallback;
            _clientCallback = null;
            t(false);
        }

        //Microsoft Edge does not adhere to the standard, and does not call the error
        //function after the specified callback, so we have to call it manually
        setTimeout(() => {
            errorFunction();
        }, _errorTimeout);
    };

    /**
     * Saves the given result
     * Is called when a geolocation query returns a result
     * @param {Position} position the result https://developer.mozilla.org/en-US/docs/Web/API/Position
     */
    const successFunction = function(position) {
        //rough first position and now more accurate one -> remove the inaccurate one
        if (_positions.length === 1 && _firstPositionIsInAccurate) {
            _positions = [];
            _firstPositionIsInAccurate = false;
        }

        _positions.push({
            geo_lat: position.coords.latitude,
            geo_long: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ,
            bearing: position.coords.heading,
            speed: position.coords.speed,
            tstamp: position.timestamp,
            provider: 'Browser'
        });
        if (_clientCallback !== null) {
            //call client that we now have a result
            let t = _clientCallback;
            _clientCallback = null;
            t(true);
        }
        if (_testVisualization !== null) {
            _testVisualization.setLocation(position.coords.latitude, position.coords.longitude);
        }
        updateCookie(position);
    };

    const errorFunction = function(reason) {
        //PositionError Object (https://developer.mozilla.org/en-US/docs/Web/API/PositionError)
        if (_clientCallback !== null) {
            //call client that we now have an error
            let t = _clientCallback;
            _clientCallback = null;
            t(false, reason);
        }
    };

    const updateCookie = function(position) {
        let coords = {};
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

    GeoTracker.prototype.stop = function() {
        if (navigator.geolocation) {
            navigator.geolocation.clearWatch(_watcher);
        }
    };

    /**
     *
     * @returns {Array} all results
     */
    GeoTracker.prototype.getResults = function() {
        //filter duplicate results that can occur when using hardware GPS devices
        //with certain Browsers
        let previousItem = null;
        _positions = _positions.filter((position) => {
            if (previousItem == null) {
                previousItem = position;
                return true;
            }
            let equal = Object.keys(position).every((key) => {
                return previousItem.hasOwnProperty(key) &&
                    previousItem[key] === position[key]
            });
            if (equal) {
                //remove this item
                return false;
            }
            else {
                previousItem = position;
                return true;
            }
        });

        return _positions;
    };

    return GeoTracker;
})();

/* getCookie polyfill */
if (typeof globalThis.setCookie === 'undefined' && globalThis.document) {
    globalThis.setCookie = (cookie_name, cookie_value, cookie_exseconds) => {

        //var exdate = new Date();
        //exdate.setDate(exdate.getDate() + cookie_exdays);

        let futuredate = new Date();
        let expdate = futuredate.getTime();
        expdate += cookie_exseconds * 1000;
        futuredate.setTime(expdate);

        //var c_value=escape(cookie_value) + ((cookie_exdays==null) ? ";" : "; expires="+exdate.toUTCString() +";");
        let c_value = encodeURIComponent(cookie_value) + ((cookie_exseconds==null) ? ";" : "; expires=" + futuredate.toUTCString() + ";");
        document.cookie = cookie_name + "=" + c_value + " path=/;";
        
    }
}

/**
 * Handles the communication with the ControlServer
 * @param rmbtTestConfig RMBT Test Configuratio
 * @param options additional options:
 *  'register': Function to be called after registration: function(event)
 *  'submit':  Function to be called after result submission: function(event)
 * @returns Object
 */
export const RMBTControlServerCommunication = (rmbtTestConfig, options) => {
    const _rmbtTestConfig = rmbtTestConfig;
    const _logger = log.getLogger("rmbtws");

    options = options || {};
    let _registrationCallback = options.register || null;
    let _submissionCallback = options.submit || null;
    const headers = options.headers || {
        'Content-Type': 'application/json'
    };

    return {
        /**
         *
         * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
         */
        obtainControlServerRegistration: (onsuccess, onerror) => {
            let json_data = {
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

            if (typeof userServerSelection !== "undefined" && userServerSelection > 0
                && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
                json_data['prefer_server'] = UserConf.preferredServer;
                json_data['user_server_selection'] = userServerSelection;
            }

            let response
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(json_data)
                }
            ).then(res => res.json()
            ).then(data => {
                response = data;
                const config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            }).catch(reason => {
                response = reason;
                _logger.error("error getting testID");
                onerror();
            }).finally(() => {
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
        getDataCollectorInfo: () => {
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerDataCollectorResource,
                {
                    method: 'GET',
                    headers
                }
            ).then(res => res.json()
            ).then(data => {
                _rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                _rmbtTestConfig.model = data.product;
                _rmbtTestConfig.os_version = data.version;
            }).catch(() => {
                _logger.error("error getting data collection response");
            });
        },

        /**
         *  Post test result
         *
         * @param {Object}  json_data Data to be sent to server
         * @param {Function} callback
         */
        submitResults: (json_data, onsuccess, onerror) => {
            //add additional parameters from the configuration, if any
            Object.assign(json_data, _rmbtTestConfig.additionalSubmissionParameters);

            let json = JSON.stringify(json_data);
            _logger.debug("Submit size: " + json.length);

            let response;
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource,
                {
                    method: 'POST',
                    headers,
                    body: json
                }
            ).then(res => res.json()
            ).then((data) => {
                response = data;
                _logger.debug(json_data.test_uuid);
                onsuccess(true);
            }).catch((reason) => {
                response = reason;
                _logger.error("error submitting results");
                onerror(false);
            }).finally(() => {
                if (_submissionCallback !== null && typeof _submissionCallback === 'function') {
                    _submissionCallback({
                        response: response,
                        request: json_data
                    });
                }
            });
        }
    }
};


"use strict";

export const TestEnvironment = (function () {
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


"use strict";

export let RMBTTestConfig = (function () {
    RMBTTestConfig.prototype.version = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.language;
    RMBTTestConfig.prototype.uuid = "";
    RMBTTestConfig.prototype.type = "DESKTOP";
    RMBTTestConfig.prototype.version_code = "0.3"; //minimal version compatible with the test
    RMBTTestConfig.prototype.client_version = "0.3"; //filled out by version information from RMBTServer
    RMBTTestConfig.prototype.client_software_version = "0.9.4";
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


"use strict";

//polyfill for microsecond-time
//https://gist.github.com/paulirish/5438650
(function() {
    if (!Date.now) {
        Date.now = function() {
            return new Date().getTime();
        }
    }

    // prepare base perf object
    if (typeof performance === 'undefined') {
        performance = {};
    }

    if (!performance.now || performance.now === undefined) {
        let nowOffset = Date.now();

        if (performance.timing && performance.timing.navigationStart) {
            nowOffset = performance.timing.navigationStart;
        }


        performance.now = function now() {
            return Date.now() - nowOffset;
        }
    }
})();


function nowMs() {
    return performance.now();
}

function nowNs() {
    return Math.round(performance.now() * 1e6); //from ms to ns
}


/**
 * Creates a new cyclic barrier
 * @param {number} parties the number of threads that must invoke await()
 *      before the barrier is tripped
 * @see http://docs.oracle.com/javase/7/docs/api/java/util/concurrent/CyclicBarrier.html
 */
function CyclicBarrier(parties) {
    "use strict";
    const _parties = parties;
    let _callbacks = [];

    const release = () => {
        //first, copy and clear callbacks
        //to prohibit that a callback registers before all others are released
        let tmp = _callbacks.slice();
        _callbacks = [];
        self.setTimeout(() => {
            for (let i = 0; i < _parties; i++) {
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
        await: (callback) => {
            _callbacks.push(callback);
            if (_callbacks.length === _parties) {
                release();
            }
        }

    }
};


/**
 * Finds the median number in the given array
 * http://caseyjustus.com/finding-the-median-of-an-array-with-javascript
 * @param {Array} values
 * @returns {Number} the median
 */
Math.median = function(values) {
    values.sort(function(a, b) {
        return a - b;
    });

    let half = Math.floor(values.length / 2);

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

class Log {
    debug(...msg) {
        console.log(...msg);
    }
    trace() {
        console.trace();
    }
    info(...msg) {
        console.info(...msg);
    }
    warn(...msg) {
        console.warn(...msg);
    }
    error(...msg) {
        console.error(...msg);
    }
    disable() {
        this.debug = function() {};
        this.trace = function() {};
        this.info = function() {};
        this.warn = function() {};
    }
    setLevel() {}
    getLogger() {
        return this;
    }
}

self.log = self.log || new Log();
export const log = self.log;


//Polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function(target, varArgs) { // .length of function is 2
        'use strict';
        if (target == null) { // TypeError if undefined or null
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource != null) { // Skip over if undefined or null
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
if (globalThis.document && typeof document.hidden === "undefined") {
    document.hidden = false;
}

