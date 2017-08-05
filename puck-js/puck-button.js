/*
 * This code turns a puck.js into a simple counting button.  It is
 * optimized for battery life. Since puck.js does better in this
 * regard when it is advertising at a reasonable rate and watching the
 * button as opposed to being connected, the count is used to relay
 * the fact the button has been pressed. The code that is part of the
 * homebridge plugin watches for the count to be different than the
 * previously seen count and then triggers an event.
 */

function Button() {
  this.pressCount = 0;
  this.advertisingParams = {
    name: "Button" + NRF.getAddress().slice(-5),
    connectable: false,
    uart: false
  };
  this.advertise();
}

Button.prototype.advertise = function() {
  NRF.setAdvertising({
    0x180f: [Puck.getBatteryPercentage()],
    0xffe0: [this.pressCount]
  }, this.advertisingParams);
};

Button.prototype.pressed = function() {
  this.pressCount += 1;
  this.advertise();
};

var button = new Button();
setWatch(function() {
    button.pressed();
}, BTN, {edge: "rising", debounce:10, repeat:true});
