# homebridge-owfs
This is a plugin for the DS18B20 temperature sensors. As Pre-requisite, you need to have OWFS installed on your RPi. This plugin relies on OWFS filesystem directly.
In a near future, this plugin will be ported on OWSERVER in order to acquire sensors remotely.

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
          "accessory": "OWFS_DS18B20",
          "name": "Temperature Sensor",
          "device": "28.0000063f4ead"
        }
      ],
    
      "platforms": []
    }
