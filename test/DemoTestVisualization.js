"use strict";

var DemoTestVisualization = (function () {
    var _rmbtTest;

    var _infogeo = null;
    var _infoserver = null;
    var _infoip = null;
    var _infostatus = null;
    var _infoprovider = null;
    var _serverName = null;
    var _remoteIp = null;
    var _providerName = null;
    var _testUUID = '';

    var _redraw_loop = null;
    var _successCallback = null;
    var _errorCallback = null;

    function DemoTestVisualization(successCallback, errorCallback) {
        if (typeof successCallback !== 'undefined') {
            _successCallback = successCallback;
            _errorCallback = errorCallback;
        }

        _infogeo = document.getElementById("infogeo");
        _infoserver = document.getElementById("infoserver");
        _infoip = document.getElementById("infoip");
        _infostatus = document.getElementById("infostatus");
        _infoprovider = document.getElementById("infoprovider");

        //reset
        _infogeo.innerHTML = '-';
        _infoserver.innerHTML = '-';
        _infoip.innerHTML = '-';
        _infoprovider.innerHTML = '-';
        $("#infoping span").text("-");
        $("#infodown span").text("-");
        $("#infoup span").text("-");
    }

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
                progressSegments = 0;
                break;
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

    /**
     * Sets the RMBT Test object
     * @param {Object} rmbtTest has to support {RMBTIntermediateResult}.getIntermediateResult
     */
    DemoTestVisualization.prototype.setRMBTTest = function (rmbtTest) {
        _rmbtTest = rmbtTest;
    };

    DemoTestVisualization.prototype.updateInfo = function (serverName, remoteIp, providerName, testUUID) {
        _serverName = serverName;
        _remoteIp = remoteIp;
        _providerName = providerName;
        _testUUID = testUUID;
    };

    /**
     * function to show current status
     * @param {string} curStatus status that will be displayed
     */
    function set_status(curStatus) {
        var elem = null;

        switch (curStatus) {
            case TestState.LOCATE:
                $("#infostatus").text('Locating');
                break;
            case TestState.INIT:
            case TestState.INIT_DOWN:
                $("#infostatus").text('Initializing');
                break;
            case TestState.WAIT:
                $("#infostatus").text('WaitForSlot');
                break;
            case TestState.INIT_UP:
                $("#infostatus").text('Init_Upload');
                elem = "infoup";
                break;
            case TestState.PING:
                $("#infostatus").text('Ping');
                elem = "infoping";
                break;
            case TestState.DOWN:
                $("#infostatus").text('Download');
                elem = "infodown";
                break;
            case TestState.UP:
                $("#infostatus").text('Upload');
                elem = "infoup";
                break;
            case TestState.END:
                $("#infostatus").text('Finished');
                break;
            case TestState.ERROR:
                $("#infostatus").text('Error');
                elem = "not-here";
                break;
            case TestState.ABORTED:
                $("#infostatus").text('Aborted');
                break;
            default:
                console.log("Unknown test state: " + curStatus);
        }
        if (elem !== null) {
            $("#infocurrent").find("div.row").not(":has(#" + elem + ")").find(".loader").hide();
            $("#infocurrent").find("div.row #" + elem + " .loader").show();
        }
        else {
            $("#infocurrent").find("div.row  .loader").hide();
        }
    }

    DemoTestVisualization.prototype.setStatus = function (status) {
        set_status(status);
    };

    DemoTestVisualization.prototype.setLocation = function (latitude, longitude) {
        //from Opentest.js
        var formatCoordinate = function (decimal, label_positive, label_negative) {
            var label = (deg < 0) ? label_negative : label_positive;
            var deg = Math.floor(Math.abs(decimal));
            var tmp = Math.abs(decimal) - deg;
            var min = tmp * 60;
            return label + " " + deg + "&deg; " + min.toFixed(3) + "'";
        };

        var text = "";
        latitude = formatCoordinate(latitude, 'N', 'S');
        longitude = '&emsp;' + formatCoordinate(longitude, 'E', 'W');
        text = latitude + " " + longitude;

        //set
        $("#infogeo").html(text);
    };

    var lastProgress = -1;
    var lastStatus = -1;

    function draw() {
        var status, ping, down, up, up_log, down_log;
        var progress, showup = "-", showdown = "-", showping = "-";
        var result = _rmbtTest.getIntermediateResult();
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
            showping = showping.toPrecision(3) + " ms";
            $("#infoping span").text(showping);
        }

        if (down > 0) {
            showdown = (down / 1000000);
            showdown = showdown.toPrecision(3) + " Mbps";
            $("#infodown span").text(showdown);
        }

        if (up > 0) {
            showup = (up / 1000000);
            showup = showup.toPrecision(3) + " Mbps";
            $("#infoup span").text(showup);
        }

        function drawLoop() {
            var fullProgress = Math.round(progress_segment(status, progress) * 100);
            $("#testprogress").css("width", fullProgress + "%");
            $("#testprogress").text(fullProgress + " %");
        };

        drawLoop();

        set_status(status);

        if (status !== "END" && status !== "ERROR" && status !== "ABORTED") {
            _redraw_loop = setTimeout(draw, 250);
            //Draw a new chart
        } else if (status === "ERROR" || status === "ABORTED") {
            if (_successCallback !== null) {
                var t = _errorCallback;
                _errorCallback = null;
                t(result);
            }
        } else if (status === "END") {
            // call callback that the test is finished
            if (_successCallback !== null) {
                var t = _successCallback;
                _successCallback = null;
                result["testUUID"] = _testUUID;
                t(result);
            }
        }
    }

    /**
     * Starts the gauge/progress bar
     * and relies on .getIntermediateResult() therefor
     *  (function previously known as draw())
     */
    DemoTestVisualization.prototype.startTest = function () {
        //first draw, then the timeout should kick in
        draw();
    };

    return DemoTestVisualization;
})();
