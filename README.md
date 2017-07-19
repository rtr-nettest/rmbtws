# RMBT Websocket Client


> This project contains a JavaScript client for conducting [RMBT](https://www.netztest.at/doc/)-based speed 
measurements, based on the WebSocket protocol


### Related materials

* [RMBT specification](https://www.netztest.at/doc/)
* [Demo implementation of this client](https://www.netztest.at/en/Test)
* [RTR-Netztest/open-rmbt](https://github.com/rtr-nettest/open-rmbt)
  
  
### Usage

For building the compiled `dist`-files, just run `npm install` and generate the files with `gulp`.

A demo file on how to use this client is provided in the "test"-Folder. It can be used when
serving from a web server, e.g. the command-line `http-server` provided on the npm registry.

Start the server with `http-server`, then point your browser 
to `http://localhost:8080/test/Websockettest.html`. In this configuration, development 
infrastructure from [RTR](https://www.netztest.at) is used. When using this infrastructure,
you agree to the [Privacy Policy](https://www.rtr.at/en/tk/netztestprivacypolicyweb) and
[Terms of Use](https://www.rtr.at/en/tk/rtrnetztesttermsofuse).

### Get in Touch

* [RTR-Netztest](https://www.netztest.at) on the web


### License

Copyright 2015-2017 Rundfunk und Telekom Regulierungs-GmbH (RTR-GmbH). This source code is licensed under the Apache license found in
the [LICENSE.txt](https://github.com/rtr-nettest/rmbtws/blob/master/LICENSE.txt) file.
The documentation to the project is licensed under the [CC BY-AT 3.0](https://creativecommons.org/licenses/by/3.0/at/deed.de_AT)
license.

