var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-bluetooth-puck-button',
				 'Puck Button', PuckButtonAccessory);
};

const EventEmitter = require('events');
const PressCountUUID = "ffe0";

function PuckButtonAccessory(log, config) {
    this.log = log;

    if (!config.name) {
	throw new Error("Missing mandatory config 'name'");
    }

    if (!config.address) {
	throw new Error(" Missing mandatory config 'address'");
    }
    
    this.address = config.address;
    this.name = config.name;
    this.prefix = "(" + this.address + ")" + " | ";
    
    this.emitter = new EventEmitter();
    this.emitter.on('pressed', this.toggleSwitchState.bind(this));
    this.emitter.on('initial-sighting', this.sighted.bind(this));
    this.emitter.on('battery-level-changed',
		    this.updateBatteryLevel.bind(this));

    /*
     * this.switchService = new Service.StatefulProgrammableSwitch();
     * Really what I want is the above, but it isn't working with Home
     * right now, so use a stateless button to simulate a stateful
     * one.  The state is stored in this object, and different press
     * events are sent one for on and one for off depending on the
     * current state.  An additional switch service is provided to
     * allow for Home to synchronize the switch state with
     * scenes. This in effect closes the loop and emulates a stateful
     * switch using two split services.
     */
    this.services = {
	button: new Service.StatelessProgrammableSwitch(),
	battery: new Service.BatteryService(),
	info: new Service.AccessoryInformation()
	    .setCharacteristic(Characteristic.Manufacturer, "Espruino")
	    .setCharacteristic(Characteristic.Model, "Puck.js")
	    .setCharacteristic(Characteristic.SerialNumber, this.address),
	state: new Service.Switch()
    };

    this.characteristics = {
	buttonEvent: this.services.button.getCharacteristic(
	    Characteristic.ProgrammableSwitchEvent),
	batteryLevel: this.services.battery.getCharacteristic(
	    Characteristic.BatteryLevel),
	state: this.services.state.getCharacteristic(Characteristic.On)
    };
    this.characteristics.batteryLevel
	.on('get', this.getBatteryLevel.bind(this));
    this.characteristics.state.on('get', this.getSwitchState.bind(this));
    this.characteristics.state.on('set', this.setSwitchState.bind(this));

    this.noble = require('noble');
    this.noble.on('stateChange', this.onStateChange.bind(this));
    this.noble.on('discover', this.onDiscoverPeripheral.bind(this));

    this.count = 0;
    this.battery = 0;
    this.seen = false;
    this.state = "off";
}

PuckButtonAccessory.prototype.eventState = function() {
    return (this.state === "off") ? 0 : 1;
};

PuckButtonAccessory.prototype.switchState = function() {
    return (this.state === "off") ? false : true;
};

PuckButtonAccessory.prototype.convertState = function(value) {
    return value ? "on" : "off";
};

PuckButtonAccessory.prototype.getServices = function() {
    var services = this.services;
    return Object.keys(services)
	.map(function(key) {
	    return services[key];
	});
};

PuckButtonAccessory.prototype.onStateChange = function(state) {
    if (state === 'poweredOn') {
	this.startScanning();
    }
};

PuckButtonAccessory.prototype.startScanning = function() {
    this.log('starting scan');
    this.noble.startScanning([PressCountUUID], true);
};

PuckButtonAccessory.prototype.onDiscoverPeripheral = function(peripheral) {
    var address = (peripheral.address === 'unknown')
	? peripheral.id : peripheral.address;

    if (address !== this.address) {
	return;
    }

    var [countObj, batteryObj] = [PressCountUUID, "180f"]
	.map(function(uuid) {
	    return peripheral.advertisement.serviceData
		.find(function(o) { return o.uuid === uuid });
	});

    if (typeof countObj === 'undefined'  || typeof batteryObj === 'undefined') {
	this.log("got invalid advertisement for: " + address + " got "
		 + peripheral.advertisement.serviceData);
	return; //invalid advertisement;
    }

    var count = countObj.data.readUInt8(0);
    var battery = batteryObj.data.readUInt8(0);

    if (this.seen === false) {
	this.emitter.emit('initial-sighting', {count: count, battery: battery});
	return;
    }

    if (this.count !== count) {
	this.emitter.emit('pressed', count);
    }

    if (this.battery !== battery) {
	this.emitter.emit('battery-level-changed', battery);
    }
};

PuckButtonAccessory.prototype.sighted = function(state) {
    this.count = state.count;
    this.battery = state.battery;
    this.seen = true;
    this.log(this.prefix + ' sighted');
};

PuckButtonAccessory.prototype.toggleSwitchState = function(count) {
    this.count = count;
    this.updateSwitchState((this.state === "off") ? "on" : "off");
    this.log(this.prefix + ' count is  ' + this.count);
};

PuckButtonAccessory.prototype.updateSwitchState = function(state) {
    this.state = state;
    this.characteristics.buttonEvent.updateValue(this.eventState());
    this.characteristics.state.updateValue(this.switchState());
    this.log(this.prefix, "set state to: " + this.state);
};

PuckButtonAccessory.prototype.getSwitchState = function(callback) {
    callback(null, this.switchState());
};

PuckButtonAccessory.prototype.setSwitchState = function(newValue, callback) {
    var newState = this.convertState(newValue);
    if (newState !== this.state) {
        this.updateSwitchState(this.convertState(newValue));
    }
    callback();
};

PuckButtonAccessory.prototype.updateBatteryLevel = function(battery) {
    this.battery = battery;
    this.batteryLevelChar.updateValue(this.battery);
    this.log(this.prefix + ' battery level changed to ' + this.battery);
};

PuckButtonAccessory.prototype.getBatteryLevel = function(callback) {
    callback(null, this.battery);
};

PuckButtonAccessory.prototype.identify = function(callback) {
    this.log(this.prefix, "Identify");
    callback();
};
