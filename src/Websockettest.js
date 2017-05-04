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
var RMBTTest = (function() {
    const _server_override = "wss://developv4-rmbtws.netztest.at:19002";

    const debug = (text) => {
        //return; //no debug
        $("#debug").prepend(text + "\n");
        console.log(text);
    };

    var _chunkSize;
    var MAX_CHUNK_SIZE = 4194304;
    var MIN_CHUNK_SIZE;
    var DEFAULT_CHUNK_SIZE;
    var _changeChunkSizes = false;

    /* @var rmbtTestConfig RMBTTestConfig */
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

    var _threads = new Array();
    var _arrayBuffers = {};
    var _endArrayBuffers = {};

    var _cyclicBarrier;
    var _numThreadsAllowed;
    var _numDownloadThreads = 0;
    var _numUploadThreads = 0;


    var _bytesPerSecsPretest;

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
        _rmbtTestConfig = rmbtTestConfig;// = new RMBTTestConfig();
        _state = TestState.INIT;
    };

    /**
     * Sets the state of the test, notifies the observers if
     * the state changed
     * @param {TestState} state
     */
    function setState(state) {
        if (_state === undefined ||
                _state !== state) {
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
    RMBTTest.prototype.onError = function(fct)  {
        _errorCallback = fct;
    }

    /**
     * Calls the error function (but only once!)
     * @param {RMBTError} error
     */
    var callErrorCallback = function(error) {
        if (!error === RMBTError.NOT_SUPPORTED) {
            setState(TestState.ERROR);
        }
        if (_errorCallback !== null) {
            var t = _errorCallback;
            _errorCallback = null;
            t();
        }
    };

    RMBTTest.prototype.startTest = function() {
        //see if websockets are supported
        if (window.WebSocket === undefined)  {
            callErrorCallback(RMBTError.NOT_SUPPORTED);
            return;
        }

        setState(TestState.INIT);
        _rmbtTestResult = new RMBTTestResult();
        //connect to controlserver
        getDataCollectorInfo(_rmbtTestConfig);

        obtainControlServerRegistration(_rmbtTestConfig, function(response) {
            _numThreadsAllowed = parseInt(response.test_numthreads);
            _cyclicBarrier = new CyclicBarrier(_numThreadsAllowed);
            _statesInfo.durationDownMs = response.test_duration * 1e3;
            _statesInfo.durationUpMs = response.test_duration * 1e3;

            //@TODO: Nicer
            //if there is testVisualization, make use of it!
            if (TestEnvironment.getTestVisualization() !== null) {
                    TestEnvironment.getTestVisualization().updateInfo(response.test_server_name,
                                response.client_remote_ip,
                                response.provider,
                                response.test_uuid);
            }

            var continuation = function() {
                debug("got geolocation, obtaining token and websocket address");
                setState(TestState.WAIT);

                //wait if we have to
                window.setTimeout(function() {
                    setState(TestState.INIT);
                    _rmbtTestResult.beginTime = (Date().now);
                    //n threads
                    for (var i = 0; i < _numThreadsAllowed; i++) {
                        var thread = new RMBTTestThread(_cyclicBarrier);
                        thread.id = i;
                        _rmbtTestResult.addThread(thread.result);

                        //only one thread will call after upload is finished
                        conductTest(response, thread, function() {

                            debug("All tests finished");
                            wsGeoTracker.stop();
                            _rmbtTestResult.geoLocations = wsGeoTracker.getResults();
                            _rmbtTestResult.calculateAll();
                            submitResults(response, function() {
                                setState(TestState.END);
                            });
                        });

                        //for now
                        //if (i===0)
                        //    break;

                        _threads.push(thread);
                    }
                }, response.test_wait*1000);
            };

            var wsGeoTracker;
            //get the user's geolocation
            if (TestEnvironment.getGeoTracker() !== null) {
                wsGeoTracker = TestEnvironment.getGeoTracker();
                continuation();
            }
            else {
                wsGeoTracker = new GeoTracker();
                debug("getting geolocation");
                wsGeoTracker.start(function() {
                    continuation();
                });
            }

        });
    };

    /**
     *
     * @returns {RMBTIntermediateResult}
     */
    RMBTTest.prototype.getIntermediateResult = function() {
        _intermediateResult.status = _state;;
        var diffTime = performance.now() - _stateChangeMs;

        switch (_intermediateResult.status)
        {
            case TestState.WAIT:
                _intermediateResult.progress = 0;
                //_intermediateResult.remainingWait = params.getStartTime() - System.currentTimeMillis();
                break;

            case TestState.INIT:
            case TestState.WAIT:
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

        _intermediateResult.progress = Math.min(1,_intermediateResult.progress);

        if (_rmbtTestResult !== null) {
            _intermediateResult.pingNano = _rmbtTestResult.ping_median;


            if (_intermediateResult.status === TestState.DOWN) {
                //download
                var total = 0;
                var targetTime = Infinity;
                for (var i = 0; i < _threads.length > 0; i++) {
                    var down = _rmbtTestResult.threads[i].down;
                    if (down.length > 0) {
                        total += down[down.length - 1].bytes;
                        if (down[down.length - 1].duration < targetTime) {
                            targetTime = down[down.length - 1].duration;
                        }
                    }
                }
                _intermediateResult.downBitPerSec = Math.max(0, (total * 8) / (targetTime / 1e9));
                _intermediateResult.downBitPerSecLog = (log10(_intermediateResult.downBitPerSec / 1e6) + 2) / 4;
            }

            if (_intermediateResult.status === TestState.UP) {
                //upload
                total = 0;
                targetTime = Infinity;
                for (var i = 0; i < _threads.length; i++) {
                    var up = _rmbtTestResult.threads[i].up;
                    if (up.length > 0) {
                        total += up[up.length - 1].bytes;
                        if (up[up.length - 1].duration < targetTime) {
                            targetTime = up[up.length - 1].duration;
                        }
                    }
                }
                _intermediateResult.upBitPerSec = Math.max(0, (total * 8) / (targetTime / 1e9));
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
        var server = ((registrationResponse.test_server_encryption) ? "wss://" : "ws://") +
                registrationResponse.test_server_address + ":" + registrationResponse.test_server_port;
        //server = server_override;
        debug(server);

        var errorFunctions = function() {
            return {
                IGNORE : function() {
                    //ignore error :)
                },
                CALLGLOBALHANDLER : function() {
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
            debug(thread.id + ": start short download");
            _chunkSize = MIN_CHUNK_SIZE;

            //only one thread downloads
            if (thread.id === 0) {
                shortDownloadtest(thread, _rmbtTestConfig.pretestDurationMs);
            }
            else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.PING, function() {
            setState(TestState.PING);
            debug(thread.id + ": starting ping");
            //only one thread pings
            if (thread.id === 0) {
                pingTest(thread);
            }
            else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.DOWN, function() {
            setState(TestState.DOWN);

            //maybe not all threads have to conduct a download speed test
            if (thread.id < _numDownloadThreads) {
                downloadTest(thread, registrationResponse.test_duration);
            }
            else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.INIT_UP, function() {
            setState(TestState.INIT_UP);
            _chunkSize = MIN_CHUNK_SIZE;
            if (thread.id === 0) {
                shortUploadtest(thread, _rmbtTestConfig.pretestDurationMs);
            }
            else {
                thread.triggerNextState();
            }
        });

        thread.onStateEnter(TestState.UP, function() {
            setState(TestState.UP);

            //maybe not all threads have to conduct an upload speed test
            if (thread.id < _numUploadThreads) {
                uploadTest(thread, registrationResponse.test_duration);
            }
            else {
                //the socket is not needed anymore,
                //close it to free up resources
                thread.socket.onerror = errorFunctions.IGNORE;
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
        }
        catch(e) {
            callErrorCallback(RMBTError.SOCKET_INIT_FAILED);
            return;
        }

        thread.socket.binaryType = "arraybuffer";
        thread.socket.onerror = errorHandler;

        thread.socket.onmessage = function(event) {
            //debug("thread " + thread.id + " triggered, state " + thread.state + " event: " + event);

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
                debug(thread.id + "Chunksizes: min " + MIN_CHUNK_SIZE +
                    ", max: " + MAX_CHUNK_SIZE +
                    ", default: " + DEFAULT_CHUNK_SIZE);
            }
            else if (event.data.indexOf("RMBTv") === 0) {
                //get server version
                var version = event.data.substring(5).trim();
                _rmbtTestConfig.client_version = version;
                if (version.indexOf("1.") === 0) {
                    _changeChunkSizes = true;
                }
                else if (version.indexOf("0.3") === 0) {
                    _changeChunkSizes = false;
                }
                else {
                    debug("unknown server version: " + version);
                }
            }
            else if (event.data === "ACCEPT TOKEN QUIT\n")
            {
                thread.socket.send("TOKEN " + token + "\n");
            }
            else if (event.data === "OK\n" && thread.state === TestState.INIT) {
                debug(thread.id + ": Token accepted");
            }
            else if (event.data === "ERR\n") {
                errorHandler();
                debug("got error msg");
            }
            else if (event.data.indexOf("ACCEPT GETCHUNKS") === 0) {
                thread.triggerNextState();
            }


        };
    }

    /**
     * conduct the short pretest to recognize if the connection
     * is to slow for multiple threads
     * @param {RMBTTestThread} thread
     * @param {Number} durationMs
     */
    function shortDownloadtest(thread, durationMs) {
        var prevListener = thread.socket.onmessage;
        var startTime = performance.now(); //ms since page load
        var n = 1;
        var bytesReceived = 0;

        var loop = function() {
            downloadChunks(thread, n, function(msg) {
                bytesReceived += n * _chunkSize;
                debug(thread.id + ": " + msg);
                let timeNs = parseInt(msg.substring(5));

                var now = performance.now();
                if ((now - startTime) > durationMs) {
                    //save circa result
                    _bytesPerSecsPretest = n * _chunkSize / (timeNs / 1e9);
                    debug(thread.id + ": circa " + _bytesPerSecsPretest / 1000 + " KB/sec");
                    debug(thread.id + ": circa " + _bytesPerSecsPretest * 8 / 1e6 + " MBit/sec");

                    //set number of upload threads according to mbit/s measured
                    let mbits = _bytesPerSecsPretest * 8 / 1e6;
                    Object.keys(_rmbtTestConfig.downloadThreadsLimitsMbit).forEach((thresholdMbit) => {
                        if (mbits > thresholdMbit) {
                            _numDownloadThreads = _rmbtTestConfig.downloadThreadsLimitsMbit[thresholdMbit];
                        }
                    });
                    _numDownloadThreads = Math.min(_numThreadsAllowed, _numDownloadThreads);
                    debug(thread.id + ": set number of threads to be used in download speed test to: " + _numDownloadThreads);

                    //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
                    let calculatedChunkSize = _bytesPerSecsPretest / (1000 / ((_rmbtTestConfig.measurementPointsTimespan/2)));

                    //round to the nearest full KB
                    calculatedChunkSize -= calculatedChunkSize % 1024;

                    //but min 4KiB
                    calculatedChunkSize = Math.max(MIN_CHUNK_SIZE, calculatedChunkSize);

                    //and max MAX_CHUNKSIZE
                    calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);

                    debug(thread.id + ": calculated chunksize for download speed test " + calculatedChunkSize / 1024 + " KB");

                    _chunkSize = calculatedChunkSize;

                    //"break"
                    thread.socket.onmessage = prevListener;
                }
                else {
                    if (n < 8 || !_changeChunkSizes) {
                        n = n * 2;
                        loop();
                    }
                    else {
                        _chunkSize = Math.min(_chunkSize * 2, MAX_CHUNK_SIZE);
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
    function downloadChunks(thread, total, onsuccess) {
        //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
        var socket = thread.socket;
        var remainingChunks = total;
        var expectBytes = _chunkSize * total;
        var totalRead = 0;

        var downloadChunkListener = function(event) {
            if (typeof event.data === 'string') {
                return;
            }

            //var lastByte;
            //console.log("received chunk with " + line.length + " bytes");
            totalRead = totalRead + event.data.byteLength;

            //in previous versions, the last byte was sent as a single websocket frame,
            //so we have to maintain compatibility at this time
            if (event.data.byteLength === _chunkSize || event.data.byteLength === 1) {
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
                _endArrayBuffers[_chunkSize] = event.data;
            }
            else {
                if (!_arrayBuffers.hasOwnProperty(_chunkSize)) {
                    _arrayBuffers[_chunkSize] = [];
                }
                if (_arrayBuffers[_chunkSize].length < _rmbtTestConfig.savedChunks) {
                    _arrayBuffers[_chunkSize].push(event.data);
                }
            }
        };
        socket.onmessage = downloadChunkListener;
        debug(thread.id + ": downloading " + total + " chunks, " + (expectBytes/1000) + " KB");
        var send = "GETCHUNKS " + total +  ((_chunkSize !== DEFAULT_CHUNK_SIZE)? " " + _chunkSize :"") + "\n";
        socket.send(send);
    }

    function pingTest(thread) {
        var shortestPing = Infinity;
        var prevListener = thread.socket.onmessage;
        var pingsRemaining = _rmbtTestConfig.numPings;


        var onsuccess = function(pingResult) {
            pingsRemaining--;

            thread.result.pings.push(pingResult);

            if (pingResult.client < shortestPing) {
                shortestPing = pingResult.client;
            }
            debug(thread.id + ": PING " + pingResult.client + " ns client; " + pingResult.server + " ns server");

            if (pingsRemaining > 0) {
                //wait for new 'ACCEPT'-message
                thread.socket.onmessage = function(event) {
                    if (event.data === "ACCEPT GETCHUNKS GETTIME PUT PUTNORESULT PING QUIT\n") {
                        ping(thread, onsuccess);
                    }
                    else {
                        debug("unexpected error during ping test")
                    }
                };
            }
            else {
                //"break

                //median ping
                var tArray = [];
                for (var i=0;i < thread.result.pings.length; i++) {
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
        var pingListener = function(event) {
            if (event.data === "PONG\n") {
                var end = nowNs();
                clientDuration = end - begin;
                thread.socket.send("OK\n");
            }
            else if (event.data.indexOf("TIME") === 0) {
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
        interval = window.setInterval(function() {
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

        var downloadListener = function(event) {
            readChunks++;
            totalRead += event.data.byteLength; //arrayBuffer
            lastTime = nowNs();

            lastChunk = event.data;
        };

        thread.socket.onmessage = downloadListener;

        var start = nowNs();
        thread.socket.send("GETTIME " + duration + ((_chunkSize !== DEFAULT_CHUNK_SIZE) ? " " + _chunkSize : "") + "\n");
    }

     /**
     * conduct the short pretest to recognize if the connection
     * is to slow for multiple threads
     * @param {RMBTTestThread} thread
     * @param {Number} durationMs
     */
    function shortUploadtest(thread, durationMs) {
        var prevListener = thread.socket.onmessage;
        var startTime = performance.now(); //ms since page load
        var n = 1;
        var bytesSent = 0;

        var performanceTest = window.setTimeout(function() {
            var endTime = performance.now();
            var duration = endTime - startTime;
            debug("diff:" + (duration - durationMs) + " (" + (duration-durationMs)/durationMs + " %)");
        },durationMs);

        var loop = function() {
            uploadChunks(thread, n, function(msg) {
                bytesSent += n * _chunkSize;
                debug(thread.id + ": " + msg);

                var now = performance.now();
                if ((now - startTime) > durationMs) {
                    //"break"

                    thread.socket.onmessage = prevListener;

                    var timeNs = parseInt(msg.substring(5)); //1e9

                    //save circa result
                    _bytesPerSecsPretest = (n * _chunkSize) / (timeNs / 1e9);
                    debug(thread.id + ": circa " + _bytesPerSecsPretest / 1000 + " KB/sec up");
                    debug(thread.id + ": circa " + _bytesPerSecsPretest * 8 / 1e6 + " MBit/sec up");

                    //set number of upload threads according to mbit/s measured
                    let mbits = _bytesPerSecsPretest * 8 / 1e6;
                    Object.keys(_rmbtTestConfig.uploadThreadsLimitsMbit).forEach((thresholdMbit) => {
                        if (mbits > thresholdMbit) {
                            _numUploadThreads = _rmbtTestConfig.uploadThreadsLimitsMbit[thresholdMbit];
                        }
                    });
                    _numUploadThreads = Math.min(_numThreadsAllowed, _numUploadThreads);
                    debug(thread.id + ": set number of threads to be used in upload speed test to: " + _numUploadThreads);


                    //set chunk size to accordingly 1 chunk every n/2 ms on average with n threads
                    let calculatedChunkSize = _bytesPerSecsPretest / (1000 / ((_rmbtTestConfig.measurementPointsTimespan/2)));

                    //round to the nearest full KB
                    calculatedChunkSize -= calculatedChunkSize % 1024;

                    //but min 4KiB
                    calculatedChunkSize = Math.max(DEFAULT_CHUNK_SIZE, calculatedChunkSize);

                    //and max MAX_CHUNKSIZE
                    calculatedChunkSize = Math.min(MAX_CHUNK_SIZE, calculatedChunkSize);

                    //get closest chunk size where there are saved chunks available
                    let closest = Number.POSITIVE_INFINITY;
                    Object.keys(_arrayBuffers).forEach((key) => {
                        let diff = Math.abs(calculatedChunkSize-key);
                        if (diff < Math.abs(calculatedChunkSize - closest)) {
                            closest = key;
                        }
                        else {
                            //if there is already a closer chunk selected, we don't need this
                            //anymore in this test and can dereference it to save heap memory
                            delete _arrayBuffers[key];
                            delete _endArrayBuffers[key];
                        }
                    });

                    debug(thread.id + ": calculated chunksize for upload speed test " + calculatedChunkSize / 1024 + " KB");
                    debug(thread.id + ": used chunk size for upload speed test will be: " + closest / 1024 + " KB");
                    _chunkSize = closest;

                }
                else {
                    //increase chunk size only if there are saved chunks for it!
                    var newChunkSize = _chunkSize * 2;
                    if (n < 8 || !_endArrayBuffers.hasOwnProperty(newChunkSize) || !_changeChunkSizes) {
                        n = n * 2;
                        loop();
                    }
                    else {
                        _chunkSize = Math.min(_chunkSize * 2, MAX_CHUNK_SIZE);
                        loop();
                    }
                }
            });
        };
        loop();

    }

    /**
     * Upload n Chunks to the test server
     * @param {Number} total how many chunks to download
     * @param {RMBTThread} thread containing an open socket
     * @param {Callback} onsuccess expects one argument (String)
     */
    function uploadChunks(thread, total, onsuccess) {
        //console.log(String.format(Locale.US, "thread %d: getting %d chunk(s)", threadId, chunks));
        var socket = thread.socket;

        socket.onmessage = function(event) {
            if (event.data.indexOf("OK") === 0) {
                //before we start the test
                return;
            }
            else if (event.data.indexOf("ACCEPT") === 0) {
                //status line after the test - ignore here for now
                return;
            }
            else {
                onsuccess(event.data); //TIME xxxx
            }
        };

        debug(thread.id + ": uploading " + total + " chunks, " + ((_chunkSize*total)/1000) + " KB");
        socket.send("PUTNORESULT" + ((_changeChunkSizes) ? " " + _chunkSize : "") + "\n"); //Put no result
        for (var i=0;i<total;i++) {
            var blob;
            if (i === (total-1)) {
                blob = _endArrayBuffers[_chunkSize];
            }
            else {
                blob = _arrayBuffers[_chunkSize][0];
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
        const fixedUnderrunBytes = (_bytesPerSecsPretest / 2) / _numUploadThreads;

        //send data for approx one second at once
        //@TODO adapt with changing connection speeds
        const sendAtOnceChunks = Math.ceil((_bytesPerSecsPretest / _numUploadThreads) / _chunkSize);

        var receivedEndTime = false;
        var keepSendingData = true;

        var lastDurationInfo = -1;
        var timeoutExtensionsMs = 0;

        var timeoutFunction = function () {
            if (!receivedEndTime) {
                //check how far we are in
                debug(thread.id + ": is 7.2 sec in, got data for " + lastDurationInfo);
                //if measurements are for < 7sec, give it time
                if ((lastDurationInfo < duration * 1e9) && (timeoutExtensionsMs < 3000)) {
                    window.setTimeout(timeoutFunction, 250);
                    timeoutExtensionsMs += 250;
                }
                else {
                    //kill it with force!
                    debug(thread.id + ": didn't finish, timeout extended by " + timeoutExtensionsMs + " ms, last info for " + lastDurationInfo);
                    thread.socket.onerror = () => {};

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
        const sendChunks = () => {
            // Monitor the buffersize as it sends and refill if it gets too low.
            if (thread.socket.bufferedAmount < fixedUnderrunBytes) {
                //debug(thread.id + ": buffer underrun");
                for (var i = 0; i < sendAtOnceChunks; i++) {
                    thread.socket.send(_arrayBuffers[_chunkSize][i % _arrayBuffers[_chunkSize].length]);
                }
            }
            else {
                //debug(thread.id + ": no buffer underrun");
            }

            if (keepSendingData) {
                setTimeout(sendChunks, 0);
            }
            else {
                return false;
            }
        };

        //set timeout function after 7,2s to check if everything went according to plan
        window.setTimeout(timeoutFunction, (duration * 1e3) + 200);

        //send end blob after 7s, quit
        window.setTimeout(() => {
            keepSendingData = false;
            thread.socket.send(_endArrayBuffers[_chunkSize]);
            thread.socket.send("QUIT\n");
        }, duration * 1e3);


        debug(thread.id + ": set timeout");


        const pattern = /TIME (\d+) BYTES (\d+)/;
        const patternEnd = /TIME (\d+)/;
        var uploadListener = function(event) {
            //start conducting the test
            if (event.data === "OK\n") {
                sendChunks();
            }

            //intermediate result - save it!
            //TIME 6978414829 BYTES 5738496
            //debug(thread.id + ": rec: " + event.data);
            var matches = pattern.exec(event.data);
            if (matches !== null) {
                const data = {
                    duration: parseInt(matches[1]),
                    bytes: parseInt(matches[2])
                };
                lastDurationInfo = data.duration;
                //debug(thread.id + ": " + JSON.stringify(data));
                thread.result.up.push(data);
            }
            else {
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

        thread.socket.send("PUT" + ((_chunkSize !== DEFAULT_CHUNK_SIZE) ? " " + _chunkSize : "") + "\n");
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

        if (typeof userServerSelection !== "undefined" && userServerSelection > 0
                && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
            json_data['prefer_server'] = UserConf.preferredServer;
            json_data['user_server_selection'] = userServerSelection;
        }

        $.ajax({
            url: rmbtTestConfig.controlServerURL + rmbtTestConfig.controlServerRegistrationResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify(json_data),
            success: function(data) {
                var config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            },
            error: function() {
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
           success: function(data) {
               rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
               rmbtTestConfig.model = data.product;
               //rmbtTestConfig.platform = data.product;
               rmbtTestConfig.os_version = data.version;
           },
           error: function() {
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
            success: function(data) {
                //var config = new RMBTControlServerRegistrationResponse(data);
                //onsuccess(config);
                debug("https://develop.netztest.at/en/Verlauf?" + registrationResponse.test_uuid);
                //window.location.href = "https://develop.netztest.at/en/Verlauf?" + registrationResponse.test_uuid;
                callback();
            },
            error: function() {
                debug("error submitting results");
            }
        });
    }

    /**
     * Gets the current state of the test
     * @returns {String} enum [INIT, PING]
     */
    RMBTTest.prototype.getState = function() {

        return "INIT";
    };

    return RMBTTest;
})();
