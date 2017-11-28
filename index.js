"use strict";

// Globals

var fs = require('fs');
var Client = require("owjs").Client;
var Service, Characteristic;
var temperatureService;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-owfs-devices", "OWFS_DS18B20", OwfsAccessory);
    homebridge.registerAccessory("homebridge-owfs-devices", "OWFS_DS2405", OwfsAccessory);
    homebridge.registerAccessory("homebridge-owfs-devices", "OWFS_DS2408", OwfsAccessory);
}


// Constructor
function OwfsAccessory(log, config) {
    this.log = log; // keep a copy of log instance
    this.name = config["name"];
    this.deviceName = config["device"];
    this.accessory = config["accessory"];
    this.hostIp = config["host_ip"] ? config["host_ip"] : 'localhost';
    this.hostPort = config["host_port"] ? config["host_port"] : 4304;
    this.switches = config.switches;
    this.OwfsCnx = new Client({host:this.hostIp, port:this.hostPort});
    this.lastupdate = 0;
    this.log("Configuring device : " + config["device"] + " on " + this.hostIp + ":" + this.hostPort);
    this.currentStatus = 0;
    this.services = [];
}

function getPortSizeAndMask(device, deviceName) {
    var portSize = 0;
    var portMask = 0;
    var ioPortName = "/" + deviceName;


    switch (device) {
        case 'OWFS_DS2405':
            portMask = 0x01;
            portSize = 1;
            ioPortName += "/PIO";
            break;

        case 'OWFS_DS2408':
            portMask = 0xFF;
            portSize = 8;
            ioPortName += "/PIO.BYTE";
            break;

        case 'OWFS_DS2413':
            portMask = 0x03;
            portSize = 2;
            ioPortName += "/PIO.BYTE";
            break;

        default:
            portMask = 1;
            portSize = 1;
            ioPortName += "/PIO";
            break;
    }
    return [portSize, portMask, ioPortName];
}

OwfsAccessory.prototype = {
    getSwitchState: function(switchMask, callback) {
        callback(null, parseInt(this.currentStatus & switchMask) ? 1 : 0);
    },
    setSwitchState: function(targetService, currentStatusState, callback, context) {
        var funcContext = 'fromSetSwitchState';

        // Callback safety
        if (context == funcContext) {
            if (callback) {
                callback();
            }
            return;
        }

        this.services.forEach(function(switchService, idx) {
            if (idx === 0) {
                // Don't check the informationService which is at idx=0
                return;
            }

            if (targetService.subtype === switchService.subtype) {
                var portMask = 1 << (this.switches[idx - 1].port - 1);
                var curState = portMask & this.currentStatus;
                var newState = 0;
                if (curState) {
                    this.currentStatus &= ~portMask;
                    newState = 0;
                } else {
                    this.currentStatus |= portMask;
                    newState = 1;
                }

                this.currentStatus &= this.portMask;
                this.log("Setting " + targetService.subtype + " : " + newState);
                this.log.debug("Setting " + this.deviceName + " mask " + portMask + " curState : " + curState + " ioPort " + this.currentStatus);
                this.OwfsCnx.write(this.ioPortName, this.currentStatus)
                    .then(function(cbk, data) {
                        cbk(null, newState);
                    }.bind(this, callback))
                    .catch(function(err) {
                        this.log("Error writing " + this.ioPortName);
                        cbk(err);
                    });
            }
        }.bind(this)); // foreach
    },

    identify: function(callback) {
        this.log("Identify requested!");
        callback(); // success
    },
    getServices: function() {
        var informationService = new Service.AccessoryInformation();

        var data = fs.readFileSync('/proc/cpuinfo', 'utf8');
        if (typeof data == 'undefined') {
            return this.log("Failed to read /proc/cpuinfo");
        }
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Dallas")
            .setCharacteristic(Characteristic.Model, "")
            .setCharacteristic(Characteristic.SerialNumber, this.deviceName);
        this.services.push(informationService);

        switch (this.accessory) {

            case 'OWFS_DS18B20':
                this.ioPortName = "/" + this.deviceName + "/temperature";
                temperatureService = new Service.TemperatureSensor(this.name);
                temperatureService
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .on('get', this.owReadTemperature.bind(this));

                temperatureService
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        minValue: -30
                    });

                temperatureService
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        maxValue: 120
                    });

                this.services.push(temperatureService);

                break;

            case 'OWFS_DS2405':
            case 'OWFS_DS2408':
            case 'OWFS_DS2413':

                var sizeAndMask = getPortSizeAndMask(this.accessory, this.deviceName);
                this.portSize = sizeAndMask[0];
                this.portMask = sizeAndMask[1];
                this.ioPortName = sizeAndMask[2];

                if (this.switches.length > this.portSize) {
                    this.log.error('Number of configured switches > portSize (' + this.switches.length + ' > ' + this.portSize + ') mask : ');
                }

                for (var i = 0; i < this.switches.length; i++) {
                    var switchName = this.switches[i].name;

                    switch (i) {
                        case 0:
                            this.log('---+--- ' + switchName);
                            break;
                        case this.switches.length - 1:
                            this.log('   +--- ' + switchName);
                            break;
                        default:
                            this.log('   |--- ' + switchName);
                    }

                    var switchService = new Service.Switch(switchName, switchName);

                    // Bind a copy of the setSwitchState function that sets 'this' to the accessory and the first parameter
                    // to the particular service that it is being called for. 
                    var switchMask = 1 << (this.switches[i].port - 1);
                    switchService
                        .getCharacteristic(Characteristic.On)
                        .on('set', this.setSwitchState.bind(this, switchService))
                        .on('get', this.getSwitchState.bind(this, switchMask));
                    this.services.push(switchService);
                }
                this.owReadPio();
                break;
            default:
                this.log("Unknwown device type");
                break;
        }
        return this.services;
    }
};

// private method : read on one wire bus
// today limited to Temperature devices
// assumption : no interleaved call to this method for a given device (one variable per instance to store cbk)
OwfsAccessory.prototype.owReadTemperature = function(cbk) {
    var data;

    if (this.lastupdate + 60 < (Date.now() / 1000 | 0)) {

        this.OwfsCnx.read(this.ioPortName)
            .then(function(cbk, data) {
                this.currentStatus = parseFloat(0.0 + data.value.trim());
                this.log("Temperature is " + this.currentStatus);
                cbk(null, this.currentStatus);
            }.bind(this, cbk))
            .catch(function(error) {
                this.log.error("Error reading " + this.ioPortName);
                cbk(error);
            }.bind(this, cbk));
    }
    return;
}

OwfsAccessory.prototype.owReadPio = function() {
    var data;
    this.OwfsCnx.read(this.ioPortName)
        .then(function(data) {
            this.currentStatus = data.value.trim();
            this.log.debug("Initial value of : " + this.ioPortName + " value : " + this.currentStatus);
        }.bind(this))
        .catch(function(error) {
            this.log.error("Error reading " + this.ioPortName);
            this.currentStatus = 0;
        }.bind(this));
    return;
}

if (!Date.now) {
    Date.now = function() {
        return new Date().getTime();
    }
}
