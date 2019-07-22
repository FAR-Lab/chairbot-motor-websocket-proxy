/*************************************************************
Filename: main.js

Description: This file is to be run on raspberry pi's 
attached to the Hoverboard motor. It receives messages from 
the server and sends them to the hoverboard controller through
the serial port.

Author: zamfi
*************************************************************/

/********************* Server Functions *********************/

if (process.argv[2] === 'gamepad') {
    const epsilon = 0.1;
    
    let speed = 0;
    let rotation = 0;
    
    const gamepad = require('gamepad');
    gamepad.init();
    if (gamepad.numDevices() !== 1) {
        console.error("Hmm...expected 1 device, instead saw", gamepad.numDevices());
        process.exit();
    }

    setInterval(gamepad.processEvents, 16);

    gamepad.on('move', function (id, axis, value) {
        console.log("move", {id, axis, value});
        switch (axis) {
        case 1: // left stick
            if (Math.abs(value) > epsilon) {
                speed = Math.max(30, -value * 100);
            } else {
                speed = 0;
            }
            break;
        case 2: // right stick
            if (Math.abs(value) > epsilon) {
                rotation = -value * 100;
            } else {
                rotation = 0;
            }
            break;
        }
        drive(speed + (rotation < -epsilon ? Math.abs(rotation) : 0), speed + (rotation > epsilon ? Math.abs(rotation) : 0));
    });
} else {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ port: 3000 });

    wss.on('connection', function connection(ws) {
        console.log('connected');
        ws.on('message', function incoming(message) {
            if (message == "ping") {
                ws.send('pong: '+leftPort.isOpen+" & "+rightPort.isOpen)
                return;
            }
            try {
                message = JSON.parse(message);
            } catch (e) {
                console.error("Unable to parse message", message, e);
                return;
            }
            drive(message.left, message.right, message.speed, message.accel);
        });
    });
}
/********************* Bot/Control Functions *********************/


var SerialPort = require("serialport");

function openPort(portName) {  
  // Setup the connection to the Neato
  var port = new SerialPort(portName, {
    baudRate: 115200
  });
    
  // Open the port and put the robot into testmode ON so we can drive
  port.on('open', function() {
    port.write('id' + '\n', function(err) {
      if (err) {
        return console.log('Error on write: ', err.message);
      }
      console.log('Controller ready on port ' + portName);
    });
  });
    
  // open errors will be emitted as an error event
  port.on('error', function(err) {
      console.log(`Error (${portName}):`, err.message);
  })
    
  // print all messages from remote
  const ReadLine = require('@serialport/parser-readline');
  const parser = port.pipe(new ReadLine({delimiter: '\n'}));
  parser.on('data', console.log);
    
  return port;
}

let p1 = process.argv[2];
let p2 = process.argv[3];
if (p1 === 'gamepad') {
    p1 = p2;
    p2 = process.argv[4];
}

let leftPort = openPort(p1 || "/dev/ttyS0");
let rightPort = openPort(p2 || "/dev/ttyUSB0");

    
/********************* Private Functions *********************/

var DRIVE_COMMAND_INTERVAL = 20; // ms between SetMotor commands.

var lastDriveTime = Date.now() - DRIVE_COMMAND_INTERVAL;
var nextDriveCommand;
var nextDriveTimeout = null;

function sendDrive() {
  console.log(JSON.stringify(nextDriveCommand));
  leftPort.write(`\r\nL${Math.round(nextDriveCommand.left)},R${Math.round(nextDriveCommand.right)}\r\n`);
  rightPort.write(`\r\nL${Math.round(nextDriveCommand.right)},R${Math.round(nextDriveCommand.left)}\r\n`);
  lastDriveTime = Date.now();
  nextDriveTimeout = null;
}

function round(n, digits) {
  var m = Math.pow(10, digits);
  return Math.round(m * n) / m;
}

// drive the robot from messsages
function drive(LWheelDist, RWheelDist, Speed, Accel) {
  var msg = {left: LWheelDist, right: -RWheelDist} // `:${round(LWheelDist, 0)},${round(RWheelDist, 0)}`
            // 'SetMotor LWheelDist ' + round(LWheelDist, 0) + ' RWheelDist ' + round(RWheelDist, 0) + 
            // ' Speed ' + round(Speed, 0) + '\n';
  nextDriveCommand = msg;
    
  var now = Date.now();
  if (now < lastDriveTime + DRIVE_COMMAND_INTERVAL) {
    if (! nextDriveTimeout) {
      nextDriveTimeout = setTimeout(sendDrive, lastDriveTime + DRIVE_COMMAND_INTERVAL - now);
    }
  } else {
    sendDrive();
  }
}


