/**
 * Handles the communication with the ControlServer
 * @param rmbtTestConfig RMBT Test Configuratio
 * @param options additional options:
 *  'register': Function to be called after registration: function(event)
 *  'submit':  Function to be called after result submission: function(event)
 * @returns Object
 */
const RMBTControlServerCommunication = (rmbtTestConfig, options) => {
    const _rmbtTestConfig = rmbtTestConfig;
    const _logger = log.getLogger("rmbtws");

    options = options || {};
    let _registrationCallback = options.register || null;
    let _submissionCallback = options.submit || null;

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
            let response;
            $.ajax({
                url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource,
                type: "post",
                dataType: "json",
                contentType: "application/json",
                data: JSON.stringify(json_data),
                success: (data) => {
                    response = data;
                    let config = new RMBTControlServerRegistrationResponse(data);
                    onsuccess(config);
                },
                error: (data) => {
                    response = data;
                    _logger.error("error getting testID");
                    onerror();
                },
                complete: () => {
                    if (_registrationCallback != null && typeof _registrationCallback === 'function') {
                        _registrationCallback({
                            response: response,
                            request: json_data
                        });
                    }
                }
            });
        },

        /**
         * get "data collector" metadata (like browser family) and update config
         *
         */
        getDataCollectorInfo: () => {
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
                error: (data) => {
                    _logger.error("error getting data collection response");
                }
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
            $.ajax({
                url: _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource,
                type: "post",
                dataType: "json",
                contentType: "application/json",
                data: json,
                success: (data) => {
                    response = data;
                    _logger.debug("https://develop.netztest.at/en/Verlauf?" + json_data.test_uuid);
                    //window.location.href = "https://develop.netztest.at/en/Verlauf?" + data.test_uuid;
                    onsuccess(true);
                },
                error: (data) => {
                    response = data;
                    _logger.error("error submitting results");
                    onerror(false);
                },
                complete: () => {
                    if (_submissionCallback !== null && typeof _submissionCallback === 'function') {
                        _submissionCallback({
                            response: response,
                            request: json_data
                        });
                    }
                }
            });
        }
    }
};
