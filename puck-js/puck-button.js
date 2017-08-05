function Button() {
  var button = {
    pressCount: 0,
    advertisingParams: {
      name: "Button",
      connectable: false
    },
    advertise: function() {
      NRF.setAdvertising({
        0x180f: [Puck.getBatteryPercentage()],
        0x1801: [button.pressCount]
      }, button.advertisingParams);
    },
    pressed: function() {
      button.pressCount += 1;
      button.advertise();
    }
  };
  button.advertise();
  return button;
}

var button = new Button();
setWatch(function() {
    button.pressed();
}, BTN, {edge: "rising", debounce:10, repeat:true});
