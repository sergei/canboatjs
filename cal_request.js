const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
const pgnToYdgwRawFormat = require("./index").pgnToYdgwRawFormat;
const FromPgn = require("./index").FromPgn;

const MFG_CODE = 2020;
const IND_CODE = 4;
const BCAST_DST = 255;
const SRC = 0;
const PRIORITY = 2;

const calRequestMsg = {
  "prio":PRIORITY,
  "pgn":126208,
  "dst":BCAST_DST,
  "src":SRC,
  "fields": {
    "Function Code":"Request",
    "PGN":130900,
    "Priority": 0x8,
    "Reserved": 0xF,
    "# of Parameters":2,
    "list":[
      {"Parameter":1,
        "Value":MFG_CODE},
      {"Parameter":3,
        "Value":IND_CODE},
    ]}
}


const calCmdMsgTemplate = {
  "prio":PRIORITY,
    "pgn":126208,
    "dst": 0,  // Must be targeted
    "src":SRC,
    "fields": {
      "Function Code":"Command",
        "PGN":130900,
        "Transmission interval": 0xFFFFFFFF,
        "Transmission interval offset": 0xFFFF,
        "# of Parameters":3,
        "list":[
          {"Parameter":1,
            "Value":MFG_CODE},
          {"Parameter":3,
            "Value":IND_CODE},
          {"Parameter":4,
            "Value":0x0c0d},
        ]}
}

const AWA_FIELD_OFFSET = 4
const AWA_CAL_SCALE = 1000
const AWS_FIELD_OFFSET = 5
const AWS_CAL_SCALE = 1000
const PI = 3.1415926535

function makeAwaResetCmd(){
  const cmd = calCmdMsgTemplate;
  cmd.fields.list[2] = {
    "Parameter":AWA_FIELD_OFFSET,
    "Value":0xFFFE
  }
  return cmd
}

function makeAwaSetCmd(awaDeg){
  const value =  Math.round(awaDeg / 180 * AWA_CAL_SCALE )
  const cmd = calCmdMsgTemplate;
  cmd.fields.list[2] = {
    "Parameter":AWA_FIELD_OFFSET,
    "Value":value
  }
  return cmd
}

function makeAwsResetCmd(){
  const cmd = calCmdMsgTemplate;
  cmd.fields.list[2] = {
    "Parameter":AWS_FIELD_OFFSET,
    "Value":0xFFFE
  }
  return cmd
}

function makeAwsSetCmd(awsRatio){
  const value =  Math.round(awsRatio * AWS_CAL_SCALE )
  const cmd = calCmdMsgTemplate;
  cmd.fields.list[2] = {
    "Parameter":AWS_FIELD_OFFSET,
    "Value":value
  }
  return cmd
}

function sendMessage(pgn) {
  const array = pgnToYdgwRawFormat(pgn);

  if (array) {
    console.log(`Sending ${array.length} PGNs:`)
    array.forEach(msg => {
      console.log(msg)
      port.write(msg + '\r\n')
    })
  }
}

const ydgwParser = new FromPgn();

ydgwParser.on("warning", (pgn, warning) => {
  console.log(`[warning] ${pgn.pgn} ${warning}`);
});


let commandSent = false
let requestSent = false

// Create a port
const port = new SerialPort({
  path: '/dev/cu.usbmodem004010251',
  baudRate: 57600,
})
const portLineReader = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))


// const calCmdMsg = makeAwaResetCmd()
// const calCmdMsg = makeAwsResetCmd()
// const calCmdMsg = makeAwaSetCmd(1)
const calCmdMsg = makeAwsSetCmd(1.1)

portLineReader.on('data', line => {
  console.log("<" + line)
  const rcvdMsg = ydgwParser.parseString(line);
  if (rcvdMsg) {
    if( rcvdMsg.pgn !== 130306)
      console.log(JSON.stringify(rcvdMsg, null, 2));

    if ( ! requestSent){
      requestSent = true
      // Get current calibration values
      sendMessage(calRequestMsg);
    }

    if ( ! commandSent && rcvdMsg.pgn === 130900) {
      commandSent = true
      calCmdMsgTemplate.dst = rcvdMsg.src
      sendMessage(calCmdMsg);
    }

  }
})

// Open errors will be emitted as an error event
port.on('error', function(err) {
  console.log('Error: ', err.message)
})

