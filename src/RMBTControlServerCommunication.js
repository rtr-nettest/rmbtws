let RMBTControlServerCommunication = (function () {
    let _logger;

    /**
     *
     * @type {RMBTTestConfig}
     */
    let _rmbtTestConfig;

    function RMBTControlServerCommunication(rmbtTestConfig) {
        _rmbtTestConfig = rmbtTestConfig;
        _logger = log.getLogger("rmbtws");
    }

    /**
     *
     * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
     */
    RMBTControlServerCommunication.prototype.obtainControlServerRegistration = function (onsuccess) {
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
        if (typeof userServerSelection !== "undefined" && userServerSelection > 0
            && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
            json_data['prefer_server'] = UserConf.preferredServer;
            json_data['user_server_selection'] = userServerSelection;
        }
        $.ajax({
            url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify(json_data),
            success: function (data) {
                let config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            },
            error: function () {
                _logger.error("error getting testID");
            }
        });
    };

    /**
     * get "data collector" metadata (like browser family) and update config
     *
     */
    RMBTControlServerCommunication.prototype.getDataCollectorInfo = function () {
        $.ajax({
            url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerDataCollectorResource,
            type: "get",
            dataType: "json",
            contentType: "application/json",
            success: (data) => {
                _rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                _rmbtTestConfig.model = data.product;
                //_rmbtTestConfig.platform = data.product;
                _rmbtTestConfig.os_version = data.version;
            },
            error: function () {
                _logger.error("error getting data collection response");
            }
        });
    };

    /**
     *  Post test result
     *
     * @param {Object}  json_data Data to be sent to server
     * @param {Function} callback
     */
    RMBTControlServerCommunication.prototype.submitResults = function (json_data, onsuccess, onerror) {
        let json = JSON.stringify(json_data);
        _logger.debug("Submit size: " + json.length);
        $.ajax({
            url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: json,
            success: (data) => {
                _logger.debug("https://develop.netztest.at/en/Verlauf?" + json_data.test_uuid);
                //window.location.href = "https://develop.netztest.at/en/Verlauf?" + data.test_uuid;
                onsuccess(true);
            },
            error: () => {
                _logger.error("error submitting results");
                onerror(false);
            }
        });
    };

    return RMBTControlServerCommunication;
}());
