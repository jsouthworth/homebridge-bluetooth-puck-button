var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-bluetooth-puck-button',
				 'Puck Button', PuckButtonAccessory);
};

const EventEmitter = require('events');

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
    this.emitter.on('pressed', this.toggleButtonState.bind(this));
    this.emitter.on('initial-sighting', this.sighted.bind(this));
    this.emitter.on('battery-level-changed', this.updateBatteryLevel.bind(this));

    /*
     * this.switchService = new Service.StatefulProgrammableSwitch();
     * Really what I want is the above, but it isn't working with Home
     * right now, so use a stateless button to simulate a stateful one.
     * the state is stored in this class, and different press events are
     * sent one for on and one for off depending on the current state.
     * This can get out of sync but only for one press, so it isn't a big deal.
     * Other commented code reflects changes needed to make this stateful in
     * the future.
     */
    this.switchService = new Service.StatelessProgrammableSwitch();
    this.batteryService = new Service.BatteryService();
    this.services = [
	this.switchService,
	this.batteryService,
	new Service.AccessoryInformation()
	    .setCharacteristic(Characteristic.Manufacturer, "Espruino")
	    .setCharacteristic(Characteristic.Model, "Puck.js")
	    .setCharacteristic(Characteristic.SerialNumber, this.address)
    ];
    this.eventCharacteristic = this.switchService.getCharacteristic(
	Characteristic.ProgrammableSwitchEvent);
    this.batteryLevelChar = this.batteryService.getCharacteristic(
	Characteristic.BatteryLevel);
    this.batteryLevelChar.on('get', this.getBatteryLevel.bind(this));
    //this.outputCharacteristic = this.switchService.getCharacteristic(
    //Characteristic.ProgrammableSwitchOutputState);

    this.noble = require('noble');
    this.noble.on('stateChange', this.onStateChange.bind(this));
    this.noble.on('discover', this.onDiscoverPeripheral.bind(this));

    this.count = 0;
    this.battery = 0;
    this.seen = false;
    this.state = "off";
}

PuckButtonAccessory.prototype.stateToCharacteristicState = function(state) {
    return (state === "off") ? 0 : 1;
};

PuckButtonAccessory.prototype.getServices = function() {
    return this.services;
};

PuckButtonAccessory.prototype.onStateChange = function(state) {
    if (state === 'poweredOn') {
	this.startScanning();
    }
};

PuckButtonAccessory.prototype.startScanning = function() {
    this.log('starting scan');
    this.noble.startScanning(['1801'], true);
};

PuckButtonAccessory.prototype.onDiscoverPeripheral = function(peripheral) {
    var address = (peripheral.address === 'unknown') ? peripheral.id : peripheral.address;

    if (address !== this.address) {
	return;
    }

    var countObj = peripheral.advertisement.serviceData
	.find(function(o) { return o.uuid === "1801" });
	
    var batteryObj = peripheral.advertisement.serviceData
	.find(function(o) { return o.uuid === "180f" });

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

PuckButtonAccessory.prototype.toggleButtonState = function(count) {
    this.state = (this.state === "off") ? "on" : "off";
    this.count = count;
    this.eventCharacteristic.updateValue(this.stateToCharacteristicState(this.state));
    //this.outputCharacteristic.updateValue(this.stateToCharacteristicState(this.state));
    this.log(this.prefix + ' toggled; state is now ' + this.state);
    this.log(this.prefix + ' count is  ' + this.count);
};

PuckButtonAccessory.prototype.updateBatteryLevel = function(battery) {
    this.battery = battery;
    this.batteryLevelChar.updateValue(this.battery);
    this.log(this.prefix + ' battery level changed to ' + this.battery);
};

PuckButtonAccessory.prototype.identify = function(callback) {
    this.log(this.prefix, "Identify");
    callback();
};

/*PuckButtonAccessory.prototype.getButtonState = function(callback) {
    callback(null, this.stateToCharacteristicState(this.state));
};*/

PuckButtonAccessory.prototype.getBatteryLevel = function(callback) {
    callback(null, this.battery);
};
