# homebridge-owfs
This is a plugin for 1-Wire temperature and humidity sensors (DS18B20, for example) as well as the DS2408 and DS2403 (switches). As Pre-requisite, you need to have OWFS installed on your RPi. 
From version 1.1.0, this plugin relies on OWSERVER protocol to poll 1-wire devices (previous versions used owfs directly through fs access).  Historical display of temperature and humidity data is available via HomeKit apps thats support graphing.

# The following 1-Wire Sensors (types) are pre-configured:
- `OWFS_DS18B20` : temperature
- `OWFS_DS2438` : temperature, humidity
- `OWFS_EDS0064` : temperature
- `OWFS_EDS0065` : temperature, humidity
- `OWFS_EDS0066` : temperature
- `OWFS_EDS0067` : temperature
- `OWFS_EDS0068` : temperature

Any 1-Wire sensor that provides temperature or humidity should be configurable.  It is also possible to pull alternate temperature and humidity values supplied by some devices. 

Installation
--------------------
    sudo npm install -g homebridge-owfs

Sample HomeBridge Configuration
--------------------
    {
      "bridge": {
        "name": "HomeBridge",
        "username": "CC:22:3D:E3:CE:30",
        "port": 51826,
        "pin": "031-45-154"
      },
    
      "description": "",
    
      "accessories": [
        {
          "accessory": "OWFS_DS2408",
          "name": "GardenSwitch",
          "device": "29.67C6697351FF",
          "switches": [
             { "name": "Main Light", "port" : "1" },
             { "name": "water", "port" : "2" },
             { "name": "Barbecue", "port" : "3" }
          ],
          "host_ip": "raspberrypi.local or whatever IP address, can be omitted if local board is used",
          "host_port: "4304 can be omitted if default 4304 port is used"
        },
        {
          "accessory": "OWFS_Sensor",
          "type": "OWFS_DS18B20",
          "name": "Temperature Sensor",
          "device": "28.0000063f4ead",
          "host_ip": "raspberrypi.local or whatever IP address, can be omitted if local board is used",
          "host_port: "4304 can be omitted if default 4304 port is used"
        },
        {
          "accessory": "OWFS_Sensor",
          "capabilities": {
                "temperature": "EDS0065/temperature", 
                "humidity": "EDS0065/humidity"
          },
          "name": "Downstairs",
          "device": "34.0000063f4eaa",
          "host_ip": "raspberrypi.local or whatever IP address, can be omitted if local board is used",
          "host_port": "4304 can be omitted if default 4304 port is used"
        }
      ],
    
      "platforms": []
    }

# Adding sensor types

- `capabilities` - This represents the capabilities of the device
- `temperature` - Add this key if the 1-Wire sensor support temperature.  The value is the owfs target for the value.  In the example above for the sensor named `Downstairs` the owfs full path would be:  `/34.0000063f4eaa/EDS0065/temperature`.
- `humidity` - Same as temperature, but for humidity.

Omitting `capabilities` and `type` will use the default of a simple temperature sensor.

# Other settings

- `update_interval` - time, in minutes, between automatic updates to HomeKit (default: 2)
- `log_days` - number of days of historical data to keep (default: 365)

Version history  
-------------------
- 1.4.0 : add historical data, timed push to homekit, flexible sensor configuration
- 1.3.4 : fix #4 issue -> negative value for 18B20
- 1.3.2 : fix #2 issue -> use of remote owfs server
- 1.3.1 : remove fs dependency not anymore necessary (install from npm was not working)
- 1.3.0 : migrate to owjs lib (there were an issue in 1.2.0 when trying to write on DS2408 using owfs)
- 1.2.0 : add ds2403 and ds2408 management (switches)
- 1.1.0 : add owserver management
- 1.0.0 : ds18b20 management through access through FS

