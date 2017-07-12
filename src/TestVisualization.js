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

let TestVisualization = (function() {
    let _imageDirectory = '../img/';

    //static values for the duration of ndt, qos since there is no info from the applet
    let _qosTestDurationMs = 10000;
    let _startTimeQos = -1;

    let _rmbtTest;

    let _noCanvas = false;

    //canvas initialization
    let _canvas1; //progression canvas
    let _canvas2; //upload/download-canvas

    let _ctx1; //context of progression canvas
    let _ctx2; //context of upload/download-canvas

    //dimensions
    let _W;
    let _H;

    //Variables
    let _degrees_status = 0; //current status of the animation
    let _new_degrees_status = 0; //current goal of the animation, volatile to jstest.js
    let _old_degrees_status = 0; //the current goal the animation is trying to achieve
    let _degrees_updwn = 0;
    let _new_degrees_updwn = 0;
    let _difference = 0;

    //let color = "lightgreen"; //green looks better to me
    let _bgcolor = "#2E4653";
    let _text;
    let _animation_loop, _redraw_loop;

    let _image;

    // Create gradients
    let _grad1;
    let _grad2;

    let _infogeo = null;
    let _infoserver = null;
    let _infoip = null;
    let _infostatus = null;
    let _infoprovider = null;
    let _spinner = null;
    let _spinnertarget = null;


    function TestVisualization() {

        //Check if Canvas is supported
        let canvasTurnOff = getParam('nocanvas');
        _noCanvas = (!Modernizr.canvas || canvasTurnOff);

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
    }

    /**
     * Sets the RMBT Test object
     * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
     */
    TestVisualization.prototype.setRMBTTest = function(rmbtTest) {
        _rmbtTest = rmbtTest;
    };

    function progress_segment(status, progress) {
        let ProgressSegmentsTotal = 96;
        let ProgressSegmentsInit = 14;
        let ProgressSegmentsPing = 15;
        let ProgressSegmentsDown = 34;
        let ProgressSegmentsUp = 33;
        let progressValue = 0;
        let progressSegments = 0;
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
        //Clear the canvas every time a chart is drawn
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
        _ctx2.arc(_W / 2, _H / 2, 114, 0 / 180, Math.PI * 1.7, false);
        //you can see the arc now
        _ctx2.stroke();

        //gauge will be a simple arc
        //Angle in radians = angle in degrees * PI / 180
        let radians1 = _degrees_status * Math.PI / 240;
        let radians2 = _degrees_updwn * Math.PI / 212;

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
        _ctx2.arc(_W / 2, _H / 2, 114, 0, radians2, false);
        //you can see the arc now
        _ctx2.stroke();

        //Lets add the text
        _ctx1.fillStyle = '#FFF';
        _ctx1.font = "bold 18pt tahoma";
        _text = Math.floor(_degrees_status / 360 * 100) + "%";
        //Lets center the text
        //deducting half of text width from position x
        let text_width = _ctx1.measureText(_text).width;
        //adding manual value to position y since the height of the text cannot
        //be measured easily. There are hacks but we will keep it manual for now.
        _ctx1.fillText(_text, _W / 2 - text_width / 2 + 4, _H / 2 + 7);

        // Down-, Upload Images
        //let image = new Image();
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

    let _serverName = null;
    let _remoteIp = null;
    let _providerName = null;
    let _testUUID = '';
    TestVisualization.prototype.updateInfo = function(serverName, remoteIp, providerName, testUUID) {
        _serverName = serverName;
        _remoteIp = remoteIp;
        _providerName = providerName;
        _testUUID = testUUID;
    };

    TestVisualization.prototype.setStatus = function(status) {
        set_status(status);
    };

    TestVisualization.prototype.setLocation = function(latitude, longitude) {
        //from Opentest.js
        let formatCoordinate = function(decimal, label_positive, label_negative) {
            let label = (deg < 0) ? label_negative : label_positive;
            let deg = Math.floor(Math.abs(decimal));
            let tmp = Math.abs(decimal) - deg;
            let min = tmp * 60;
            return label + " " + deg + "&deg; " + min.toFixed(3) + "'";
        };

        let ausgabe = document.getElementById("infogeo");
        latitude = formatCoordinate(latitude,Lang.getString('North'), Lang.getString('South'));
	    longitude = '<br />' + formatCoordinate(longitude, Lang.getString('East'), Lang.getString('West'));
        ausgabe.innerHTML = latitude + " " + longitude;
    };

    /**
     * Starts the gauge/progress bar
     * and relies on .getIntermediateResult() therefore
     *  (function previously known as draw())
     */
    TestVisualization.prototype.startTest = function() {
        //reset error
        close_errorPopup();

        //first draw, then the timeout should kick in
        draw();
    };

    let lastProgress = -1;
    let lastStatus = -1;
    function draw() {
        let getSignificantDigits = function(number) {
            if (number > 100) {
                return -1;
            }
            else if (number >= 10) {
                return 0;
            }
            else if (number >= 1) {
                return 1;
            }
            else if (number >= 0.1) {
                return 2;
            }
            else {
                return 3;
            }
        };

        let status, ping, down, up, up_log, down_log;
        let progress, showup = "-", showdown = "-", showping = "-";
        let result = _rmbtTest.getIntermediateResult();
        if (result === null || (result.progress === lastProgress && lastProgress !== 1 && lastStatus === result.status.toString())
                && lastStatus !== TestState.QOS_TEST_RUNNING && lastStatus !== TestState.QOS_END && lastStatus !== TestState.SPEEDTEST_END) {
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
            showping = (ping / 1000000);
            showping = showping.formatNumber(getSignificantDigits(showping)) + " " + Lang.getString('ms');
        }

        if (down > 0) {
            showdown = (down / 1000000);
            showdown = showdown.formatNumber(getSignificantDigits(showdown)) + " " + Lang.getString("Mbps");
        }

        if (up > 0) {
            showup = (up / 1000000);
            showup = showup.formatNumber(getSignificantDigits(showup)) + " " + Lang.getString("Mbps");
        }

        let drawCanvas = function() {
            console.log(status + ": " + progress);
            let prog = progress_segment(status, progress);
            //console.log("Prog: "+prog);
            //if (status != 'END' && status != 'ERROR' && status != 'ABORTED') {

            //Cancel any movement animation if a new chart is requested
            if (typeof _animation_loop !== "undefined") {
                clearInterval(_animation_loop);
            }

            //random degree from 0 to 360
            //new_degrees = Math.round(Math.random()*360);
            _new_degrees_status = Math.round(prog * 360) + 1;


            document.getElementById('showPing').innerHTML = showping;
            document.getElementById('showDown').innerHTML = showdown;
            document.getElementById('showUp').innerHTML = showup;

            if (status === "DOWN") {
                if (down_log > 1)
                    down_log = 1;
                _degrees_updwn = Math.round(down_log * 360);
                let imgPath = _imageDirectory + "speedtest/download-icon.png";
                if (_image.src !== imgPath) {
                    _image.src = imgPath;
                }
            } else if (status === "UP") {
                if (up_log > 1) {
                    up_log = 1;
                }
                _degrees_updwn = Math.round(up_log * 360);
                let imgPath = _imageDirectory + "speedtest/upload-icon.png";
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
        let drawNoCanvas = function() {
            let show_prog = progress * 100;
            if (show_prog < 100) {
                show_prog = show_prog.toPrecision(2);
            } else {
                show_prog = 100;
            }
            $('#progbar').css('width', Math.floor(210 + (show_prog * 2.1)) + 'px');
            let show_prog_tmp = (show_prog / 2);
            if (status === TestState.UP) {
                show_prog_tmp += 50;
            }
            if (show_prog_tmp < 100) {
                show_prog_tmp = show_prog_tmp.toPrecision(2);
            } else {
                show_prog_tmp = 100;
            }
            $('#progbar').html(show_prog_tmp + "%");
            $('#activity-indicator').html("(" + show_prog + "%)");
            let ulbar_width = Math.floor(up_log * 420);
            $('#ulbar').css('width', ulbar_width + 'px');
            $('#ulbar').html(showup);
            $("#showUp").html(showup);

            let dlbar_width = Math.floor(down_log * 420);
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
        } else if (status === "ERROR" || status === "ABORTED") {

        } else if (status === "END") {
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
                let opts = {
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
                    _startTimeQos = (new Date()).getTime();
                }
                let now = (new Date()).getTime();
                let progress = Math.min(1,(now - _startTimeQos)/_qosTestDurationMs);

                _infostatus.innerHTML = Lang.getString('QosTest') + " (" + Math.round(progress*100) + "&nbsp;%)";
                break;
            case TestState.QOS_END:
            case TestState.SPEEDTEST_END:
                //this could be the NDT test running
                if(_rmbtTest.getNdtStatus() !== null && _rmbtTest.getNdtStatus().toString() === "RUNNING") {
                    let progress = _rmbtTest.getNdtProgress();
                    _infostatus.innerHTML = Lang.getString('NDT') + " (" + Math.round(progress*100) + "&nbsp;%)";
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
                if (!noJava)
                    start_test();
                else
                    start_jstest();
                break;
            default:
                console.log("Unknown test state: " + curStatus);
        }
    }

    function redirectToTestResult() {
        let forwardUrl = "/" + selectedLanguage + "/Verlauf";
        if (preferredTest === TestTypes.Java || getParam("Java")) {
            forwardUrl += "?Java=True"
        }
        forwardUrl += "#";
        forwardUrl += _testUUID;
        setTimeout(function() {
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
        if (_degrees_status >= _new_degrees_status) {
            clearInterval(_animation_loop);
        }

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
})();
