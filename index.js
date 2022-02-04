"use strict";

// Globals

var fs = require('fs');
var Client = require("owjs").Client;
var Service, Characteristic, FakeGatoHistoryService;
var temperatureService;
var humidityService;
const moment = require('moment');

var owfsDevices = {
    "OWFS_DS2405":  {'addressable switch': ''},
    "OWFS_DS2408":  {'addressable switch': ''},
    "OWFS_DS18B20": {'temperature': 'temperature'},
    "OWFS_DS2438":  {'temperature': 'temperature', 
                     'humidity': 'humidity'},
    "OWFS_EDS0064": {'temperature': 'EDS0064/temperature'}, 
    "OWFS_EDS0065": {'temperature': 'EDS0065/temperature',
                     'humidity': 'EDS0065/humidity'}, 
    "OWFS_EDS0066": {'temperature': 'EDS0066/temperature'}, 
    "OWFS_EDS0067": {'temperature': 'EDS0067/temperature'}, 
    "OWFS_EDS0068": {'temperature': 'EDS0068/temperature'}, 
    "OWFS_Sensor":  {'temperature': 'temperature'}
}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    FakeGatoHistoryService = require('fakegato-history')(homebridge);

    homebridge.registerAccessory("homebridge-owfs", "OWFS_Sensor", OwfsAccessory); // Specify environmental sendor
    //homebridge.registerAccessory("homebridge-owfs", "OWFS_DS2405", OwfsAccessory);
    //homebridge.registerAccessory("homebridge-owfs", "OWFS_DS2408", OwfsAccessory);
    //homebridge.registerAccessory("homebridge-owfs", "OWFS_DS18B20", OwfsAccessory);
    //homebridge.registerAccessory("homebridge-owfs", "OWFS_DS2438", OwfsAccessory);

}


// Constructor
function OwfsAccessory(log, config) {
    this.log = log; // keep a copy of log instance
    this.name = config["name"];
    this.deviceName = config["device"];
    this.accessory = config["accessory"];
    this.deviceType = config["type"] || this.accessory;
    this.settings = config["capabilities"] || owfsDevices[this.deviceType];
    this.hostIp = config["host_ip"] || 'localhost';
    this.hostPort = config["host_port"] || 4304;
    this.update_interval = config['update_interval'] || 2; // minutes
    this.log_days = config['log_days'] || 365;
    
    this.services = [];
    this.switches = config.switches;
    this.OwfsCnx = new Client({host:this.hostIp, port:this.hostPort});
    this.log("Configuring device : " + config["device"] + " on " + this.hostIp + ":" + this.hostPort);
    this.log("Capabilities: " + Object.keys(this.settings).join(','))
    this.currentStatus = 0;
    this.reading = {'temperature':0, 'humidity':0};
    this.dataPresent = {'temperature':false, 'humidity':false};
    this.waiting_response = {'temperature': false, 'humidity': false};
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
    setSwitchState: function(targetService, requestedState, callback, context) {
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
                if (requestedState === false) {
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

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Dallas")
            .setCharacteristic(Characteristic.Model, this.deviceType)
            .setCharacteristic(Characteristic.SerialNumber, this.deviceName);
        this.services.push(informationService);

        switch (this.deviceType) {
            case 'OWFS_Sensor':
            case 'OWFS_DS18B20':
                if (this.settings.humidity) {
                    this.humidityService = new Service.HumiditySensor(this.name);
                    this.humidityService 
                        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                        .on('get', this.getState.bind(this,"humidity"));

                    this.services.push(this.humidityService);

                    this.timer_hum = setInterval(this.updateState.bind(this,"humidity"), this.update_interval * 60000);
                }        
                if (this.settings.temperature) {
                    this.temperatureService = new Service.TemperatureSensor(this.name);
                    this.temperatureService
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .setProps({ minValue: -100, maxValue: 100, minStep: 0.1 })
                        .on('get', this.getState.bind(this,"temperature"));
                    this.services.push(this.temperatureService);

                    this.timer_temp = setInterval(this.updateState.bind(this,"temperature"), this.update_interval * 60000);
                
                    // Setup FakeGatoHistory on temperature - this will be
                    // used to log both temperature and humidity
                
                    this.temperatureService.log = this.log;
                    this.loggingService = new FakeGatoHistoryService('room', this.temperatureService, {size: this.log_days*24*6, storage:'fs'});
                    this.services.push(this.loggingService);
            
                }
                break;
            case 'OWFS_DS2405':
            case 'OWFS_DS2408':
            case 'OWFS_DS2413':

                var sizeAndMask = getPortSizeAndMask(this.deviceType, this.deviceName);
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
                this.log("Unknown device type");
                break;
        }
        return this.services;
    },

    addHistoryCallback: function(err, temp) {
        if (err) return console.error(err);
        this.historyService.addEntry({ time: moment().unix(), temp: temp, humidity: 50, ppm: 0 })
    }
};

// private method : read on one wire bus
// today limited to Temperature devices
// assumption : no interleaved call to this method for a given device (one variable per instance to store cbk)
OwfsAccessory.prototype.updateState = function(d_type) {
    var data;
    var newReading;
    var logData = {};

    if (this.waiting_response[d_type]) {
        this.log('Avoid updateState as previous response has not arrived yet for ' + this.ioPortName + '/' + d_type);
        return;
    }
    this.waiting_response[d_type] = true;
    this.OwfsCnx.read('/' + this.deviceName + '/' + this.settings[d_type])
        .then(function(data) {
            newReading = parseFloat(data.value.trim());

            if (newReading != this.reading[d_type]) {
                this.reading[d_type] = newReading;
                this.dataPresent[d_type] = true;
                this.log(d_type + " is " + this.reading[d_type]);
                if (d_type == 'temperature') {
                    this.temperatureService
                        .getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.reading[d_type], null);
                } else {
                    this.humidityService
                        .getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.reading[d_type], null);
                }
            } else {
                this.log(d_type + " no change");
            }
            
            // Only log if it's the temperature accessory being processed
            
            if (d_type == 'temperature') {
                logData.time = moment().unix();
                logData.temp = this.reading['temperature'];
                if (this.dataPresent['humidity']) {
                    logData.humidity = this.reading['humidity'];
                }
                this.loggingService.addEntry(logData);
            }
            this.waiting_response[d_type] = false;
            return this.reading[d_type];
        }.bind(this))
        .catch(function(error) {
            this.log.error("Error reading " + this.ioPortName + '/' + d_type + ' ' + error);
            this.waiting_response[d_type] = false;
            return error;
        }.bind(this));
    return;
}

OwfsAccessory.prototype.getState = function(d_type, cbk) {
    this.updateState(d_type);
    cbk(null, this.reading[d_type]);
    return this.reading[d_type];
}


OwfsAccessory.prototype.owReadPio = function() {
    var data;
    this.log("ioPortName is " + this.ioPortName);
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

