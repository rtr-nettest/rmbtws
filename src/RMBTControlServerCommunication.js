let RMBTControlServerCommunication = (function () {
    function RMBTControlServerCommunication() {
        this.logger = new Logger();
    }

    /**
     *
     * @type {Logger}
     */
    RMBTControlServerCommunication.prototype.logger = null;

    /**
     *
     * @param {RMBTTestConfig} rmbtTestConfig
     * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
     */
    RMBTControlServerCommunication.prototype.obtainControlServerRegistration = function (rmbtTestConfig, onsuccess) {
        let json_data = {
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
            success: function (data) {
                let config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            },
            error: function () {
                this.logger.error("error getting testID");
            }
        });
    };

    /**
     * get "data collector" metadata (like browser family) and update config
     *
     * @param {RMBTTestConfig} rmbtTestConfig
     */
    RMBTControlServerCommunication.prototype.getDataCollectorInfo = function (rmbtTestConfig) {
        $.ajax({
            url: rmbtTestConfig.controlServerURL + rmbtTestConfig.controlServerDataCollectorResource,
            type: "get",
            dataType: "json",
            contentType: "application/json",
            success: function (data) {
                rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                rmbtTestConfig.model = data.product;
                //rmbtTestConfig.platform = data.product;
                rmbtTestConfig.os_version = data.version;
            },
            error: function () {
                this.logger.error("error getting data collection response");
            }
        });
    };

    /**
     *  Post test result
     *
     * @param {String} url Where to send test result
     * @param {Object}  json_data Data to be sent to server
     * @param {Function} callback
     */
    RMBTControlServerCommunication.prototype.submitResults = function (url, json_data, callback) {
        let json = JSON.stringify(json_data);
        this.logger.debug("Submit size: " + json.length);
        $.ajax({
            url: url,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: json,
            success: (data) => {
                this.logger.debug("https://develop.netztest.at/en/Verlauf?" + json_data.test_uuid);
                //window.location.href = "https://develop.netztest.at/en/Verlauf?" + data.test_uuid;
                callback();
            },
            error: () => {
                this.logger.error("error submitting results");
            }
        });
    };

    return RMBTControlServerCommunication;
}());
