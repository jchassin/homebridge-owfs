"use strict";
 
// Globals
var fs = require('fs');
var Client = require("owfs").Client;
var Service, Characteristic;
var temperatureService;

module.exports = function (homebridge)
  {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-temperature-owfs_ds18b20", "OWFS_DS18B20", TemperatureAccessory);
  }


// Constructor
function TemperatureAccessory(log, config)
{
  this.log = log; // keep a copy of log instance
  this.name = config["name"];
  this.deviceName = config["device"];
  this.hostIp = config["host_ip"]?config["host_ip"]:'localhost';
  this.hostPort = config["host_port"]?config["host_port"]:4304;
  this.log("Connecting to " + this.hostIp + " " + this.hostPort);
  this.OwfsCnx = new Client(this.hostIp, this.hostPort) ;
  this.lastupdate = 0;
  this.log("TemperatureAccessory : " + config["device"]);
  this.hbCallback = "";
  this.temperature = "" ;
}

TemperatureAccessory.prototype =
  {
    getState: function (callback)
    {
    // Only fetch new data once per minute
    if (this.lastupdate + 60 < (Date.now() / 1000 | 0))
    {
      var devicePath = this.deviceName + '/temperature';
      this.owRead(devicePath, callback);
    }
   
    },

    identify: function (callback)
    {
    this.log("Identify requested!");
    callback(); // success
    },

    getServices: function ()
    {
      var informationService = new Service.AccessoryInformation();

      var data = fs.readFileSync('/proc/cpuinfo', 'utf8');
      if (typeof data == 'undefined') { return this.log("Failed to read /proc/cpuinfo"); }
      informationService
        .setCharacteristic(Characteristic.Manufacturer, "Dallas")
        .setCharacteristic(Characteristic.Model, "")
        .setCharacteristic(Characteristic.SerialNumber, this.deviceName);

      temperatureService = new Service.TemperatureSensor(this.name);
      temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getState.bind(this));

      temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({minValue: -30});
        
      temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({maxValue: 120});

    return [informationService, temperatureService];
    }
  };

// private method : read on one wire bus
// today limited to Temperature devices
// assumption : no interleaved call to this method for a given device (one variable per instance to store cbk)
TemperatureAccessory.prototype.owRead = function (subPath, cbk)
{
    var data;
    this.hbCallback = cbk;

    this.OwfsCnx.read( "/" + subPath, function (err, data) {
      if (err) {
         this.log("Error reading " + this.deviceName); 
         this.hbCallback(err);  
      }
      else
      {
         this.temperature = (0.0+parseFloat(data));
         this.log("Temperature is " + this.temperature);
         temperatureService.setCharacteristic(Characteristic.CurrentTemperature, this.temperature);
         this.hbCallback(null, this.temperature);
      }
    }.bind(this));
 
    return;
}

if (!Date.now)
  {
  Date.now = function() { return new Date().getTime(); }
  }
