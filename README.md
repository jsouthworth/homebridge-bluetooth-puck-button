# homebridge-bluetooth-puck-button

This homebridge-plugin emulates a stateful programmable switch since the Home app does not yet support this type of accessory natively. It provides accessories with 2 services, a StatelessProgrammableSwitch and a Switch. The StatelessProgrammableSwitch is used to allow the switch to control Scenes in the Home app. The Switch is used to track the current state of the switch. In order for the switch to stay in sync with Scene activation it should be added as part of the Scene's accessories.

This plugin provides a program that can be uploaded to a [puck.js](http://www.puck-js.com) which will turn it into a bluetooth counting button. Each time the button is pressed the count is incremented and is placed in the BLE advertisement. We use the advertisement to relay the state since this is the most power efficient of the options for the puck.js devices. Since the button code is simple it should be pretty easy to make other such devices work with this plugin. 

The homebridge plugin will listen for this advertisement and will record the initial count. When the count changes, the homebridge plugin will register this as a request to change the switch state and toggle the state of the Switch. This will be relayed as a single press for "off" and a double press for "on" for the StatelessProgrammableSwitch events.

The plugin can cache the state of the Switch so that it will not be lost when homebridge is restarted. This is done by providing a "statePath" to the configuration.

## Installation

npm install -g homebridge-bluetooth-puck-button

## Configuration

A sample configuration is provided below.

```json
    "accessories": [
	{
	    "accessory": "Puck Button",
	    "name": "Office Light Switch",
	    "address": "d1:10:1b:xx:xx:xx",
	    "statePath": "/var/lib/homebridge/persist/office-light-switch-state.json"
	}
    ]
```

## TODO
 - Split the switch functionallity from the button press sensing so other button sensing strategies could be used but the stateful switch emulation could be reused. I don't have any need for this at the moment but it shouldn't be too difficult.