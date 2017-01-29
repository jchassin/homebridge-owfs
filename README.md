# homebridge-owfs
This is a plugin for the DS18B20 temperature sensors. As Pre-requisite, you need to have OWFS installed on your RPi. 
From version 1.1.0, this plugin relies on OWSERVER protocol to poll 1-wire devices (previous versions used owfs directly through fs access).

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
          "accessory": "OWFS_DS18B20",
          "name": "Temperature Sensor",
          "device": "28.0000063f4ead",
          "host_ip": "raspberrypi.local or whatever IP address, can be omitted if local board is used",
          "host_port: "4304 can be omitted if default 4304 port is used"
        }
      ],
    
      "platforms": []
    }

Version history  
-------------------
- 1.3.1 : remove fs dependency not anymore necessary (install from npm was not working)
- 1.3.0 : migrate to owjs lib (there were an issue in 1.2.0 when trying to write on DS2408 using owfs)
- 1.2.0 : add ds2403 and ds2408 management (switches)
- 1.1.0 : add owserver management
- 1.0.0 : ds18b20 management through access through FS

