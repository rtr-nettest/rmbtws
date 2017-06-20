let RMBTControlServerCommunication = (function () {
    function RMBTControlServerCommunication(rmbtTestConfig) {
        this._logger = new Logger();
        this._rmbtTestConfig = rmbtTestConfig;
    }

    /**
     *
     * @type {Logger}
     */
    RMBTControlServerCommunication.prototype._logger = null;
    /**
     *
     * @type {RMBTTestConfig}
     */
    RMBTControlServerCommunication.prototype._rmbtTestConfig = null;

    /**
     *
     * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
     */
    RMBTControlServerCommunication.prototype.obtainControlServerRegistration = function (onsuccess) {
        let json_data = {
            version: this._rmbtTestConfig.version,
            language: this._rmbtTestConfig.language,
            uuid: this._rmbtTestConfig.uuid,
            type: this._rmbtTestConfig.type,
            version_code: this._rmbtTestConfig.version_code,
            client: this._rmbtTestConfig.client,
            timezone: this._rmbtTestConfig.timezone,
            time: new Date().getTime()
        };
        if (typeof userServerSelection !== "undefined" && userServerSelection > 0
            && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
            json_data['prefer_server'] = UserConf.preferredServer;
            json_data['user_server_selection'] = userServerSelection;
        }
        $.ajax({
            url: this._rmbtTestConfig.controlServerURL + this._rmbtTestConfig.controlServerRegistrationResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify(json_data),
            success: function (data) {
                let config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            },
            error: function () {
                this._logger.error("error getting testID");
            }
        });
    };

    /**
     * get "data collector" metadata (like browser family) and update config
     *
     */
    RMBTControlServerCommunication.prototype.getDataCollectorInfo = function () {
        $.ajax({
            url: this._rmbtTestConfig.controlServerURL + this._rmbtTestConfig.controlServerDataCollectorResource,
            type: "get",
            dataType: "json",
            contentType: "application/json",
            success: (data) => {
                this._rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                this._rmbtTestConfig.model = data.product;
                //this._rmbtTestConfig.platform = data.product;
                this._rmbtTestConfig.os_version = data.version;
            },
            error: function () {
                this._logger.error("error getting data collection response");
            }
        });
    };

    /**
     *  Post test result
     *
     * @param {Object}  json_data Data to be sent to server
     * @param {Function} callback
     */
    RMBTControlServerCommunication.prototype.submitResults = function (json_data, callback) {
        let json = JSON.stringify(json_data);
        this._logger.debug("Submit size: " + json.length);
        $.ajax({
            url: this._rmbtTestConfig.controlServerURL + this._rmbtTestConfig.controlServerResultResource,
            type: "post",
            dataType: "json",
            contentType: "application/json",
            data: json,
            success: (data) => {
                this._logger.debug("https://develop.netztest.at/en/Verlauf?" + json_data.test_uuid);
                //window.location.href = "https://develop.netztest.at/en/Verlauf?" + data.test_uuid;
                callback();
            },
            error: () => {
                this._logger.error("error submitting results");
            }
        });
    };

    return RMBTControlServerCommunication;
}());
