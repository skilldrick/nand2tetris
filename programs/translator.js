#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var _ = require('lodash');


var labelIndex = 0;
function generateNewLabel() {
  const id = ++labelIndex;
  const label = "LABEL" + id;

  return {
    address: "@" + label,
    marker: "(" + label + ")"
  };
}

var returnLabelIndex = 0;
function generateNewReturnLabel(className) {
  if (!className) throw new Error("Need to pass through className");
  const id = ++returnLabelIndex;
  const label = className + "$ret." + id;

  return {
    address: "@" + label,
    marker: "(" + label + ")"
  };
}

function staticAddress(value, className) {
  if (!className) throw new Error("Need to pass through className");
  return '@' + className + '.' + value;
}

// binary op needs to decrement SP by 1
function binaryOperation(op) {
  return [
    '@SP',     // load stack pointer
    'AM=M-1',  // set A to address of top value in stack and decrement SP
    'D=M',     // set D to top value in stack
    'A=A-1',   // decrement A to address of second top value in stack
    op         // apply operation
  ]
}

// unary op should not change SP
function unaryOperation(op) {
  return [
    '@SP',     // load stack pointer
    'A=M-1',   // set A to address of top value in stack
    op
  ];
}

function comparisonOperation(comp) {
  const ifTrue = generateNewLabel();
  const cont = generateNewLabel();

  return [
    '@SP',          // load stack pointer
    'AM=M-1',       // set A to address of top value in stack and decrement SP
    'D=M',          // set D to top value in stack
    'A=A-1',        // decrement A to address of second top value in stack
    'D=M-D',        // subtract top value from second top value
    ifTrue.address, // set ifTrue as jump destination // for some reason this is always jumping
    'D;' + comp,    // jump to ifTrue if `comp` passes (based on result of M-D)
    '@SP',          // load stack pointer
    'A=M-1',        // set A to address of top value in stack
    'M=0',          // didn't jump so set M to false
    cont.address,   // set cont as jump destination
    '0;JMP',        // jump to cont
    ifTrue.marker,  // ifTrue marker - jump here if `comp` passes
    '@SP',          // we want to save output in *SP
    'A=M-1',        // set A to address of top value in stack
    'M=-1',         // was true so set M to true
    cont.marker
  ];
}

const operations = {
  add: () => binaryOperation('M=M+D'),
  sub: () => binaryOperation('M=M-D'),
  neg: () => unaryOperation('M=-M'),
  and: () => binaryOperation('M=M&D'),
  or:  () => binaryOperation('M=M|D'),
  not: () => unaryOperation('M=!M'),
  eq:  () => comparisonOperation('JEQ'),
  gt:  () => comparisonOperation('JGT'),
  lt:  () => comparisonOperation('JLT'),
};

const segments = {
  local: '@LCL',
  argument: '@ARG',
  this: '@THIS',
  that: '@THAT',
}

const pointers = {
  0: '@THIS',
  1: '@THAT',
};

// push D register to stack
const pushD = [
  '@SP',
  'A=M',
  'M=D',
  '@SP',
  'M=M+1'
];

function push(type, value, className) {
  if (type === 'constant') {
    return [
      // set D to value
      '@' + value,
      'D=A',
    ].concat(pushD);

  } else if (type === 'static') {
    return [
      // set D to *@File.value
      staticAddress(value, className),
      'D=M',
    ].concat(pushD);

  } else if (type === 'temp') {
    return [
      // set D to *(value + 5)
      '@' + value,
      'D=A',
      '@5', // temp memory offset
      'A=D+A',
      'D=M',
    ].concat(pushD);

  } else if (type === 'pointer') {
    const POINTER = pointers[value];
    return [
      // Set D to *THIS or *THAT (depending on value == 0 or value == 1)
      POINTER,
      'D=M',
    ].concat(pushD);

  } else if (segments[type]) {
    const SEGMENT = segments[type];
    return [
      // Set D to *(SEGMENT + value)
      '@' + value,
      'D=A',
      SEGMENT,
      'A=M',
      'A=A+D',
      'D=M',
    ].concat(pushD);

  } else {
    throw new Error(type + " not implemented yet");
  }
}

const popD = [
  // Decrement SP and load top value in D
  '@SP',
  'AM=M-1',
  'D=M',
];

function pop(type, value, className) {
  if (type === 'static') {
    return popD.concat([
      // Store D in static address
      staticAddress(value, className),

      'M=D',
    ]);

  } else if (type === 'temp') {
    return popD.concat([
      // Store D in (value + 5)
      '@' + value,
      'A=A+1',
      'A=A+1',
      'A=A+1',
      'A=A+1',
      'A=A+1',
      'M=D'
    ]);

  } else if (type === 'pointer') {
    const POINTER = pointers[value];
    return popD.concat([
      // Store D in THIS or THAT (depending on value == 0 or value == 1)
      POINTER,
      'M=D',
    ]);

  } else if (segments[type]) {
    const SEGMENT = segments[type];
    return [
      // Update SEGMENT to SEGMENT + value
      '@' + value,
      'D=A',
      SEGMENT,
      'M=M+D',

      ...popD,

      // Store D in *SEGMENT
      SEGMENT,
      'A=M',
      'M=D',

      // Reset SEGMENT with SEGMENT - value
      '@' + value,
      'D=A',        // load `value` (SEGMENT offset) into D
      SEGMENT,
      'M=M-D',      // decrease SEGMENT by `value`
    ];

  } else {
    throw new Error(type + " not implemented yet");
  }
}

function label(label) {
  return [
    "(" + label + ")"
  ];
}

function goto(label) {
  return [
    "@" + label,
    "0;JMP"
  ];
}

function ifGoto(label) {
  return [
    ...popD,
    "@" + label,
    "D;JNE" // if D is true (-1) then it is not equal to 0
  ];
}

function function_(name, nVars) {
  // need to push nVars zeroes to the stack
  var locals = [];
  for (let i = 0; i < nVars; i++) {
    locals = locals.concat([
      "@0",
      "D=A",
      ...pushD
    ]);
  }

  return [
    "(" + name + ")",
    ...locals,
  ];
}

function call(name, nArgs, className) {
  const returnLabel = generateNewReturnLabel(className);

  function pushAddress(address) {
    return [
      address,
      'D=A',
      ...pushD,
    ];
  }

  function pushValueAtAddress(address) {
    return [
      address,
      'D=M',
      ...pushD,
    ];
  }

  return [
    ...pushAddress(returnLabel.address),
    ...pushValueAtAddress('@LCL'),
    ...pushValueAtAddress('@ARG'),
    ...pushValueAtAddress('@THIS'),
    ...pushValueAtAddress('@THAT'),

    // Set *ARG to equal *SP
    '@SP',
    'D=M',
    '@ARG',
    'M=D',

    // Update @ARG to new value (SP - 5 - nArgs)
    '@5',
    'D=A',
    '@ARG',
    'M=M-D',

    '@' + nArgs,
    'D=A',
    '@ARG',
    'M=M-D',

    // Set *LCL to equal *SP
    '@SP',
    'D=M',
    '@LCL',
    'M=D',

    // jump to function
    '@' + name,
    '0;JMP',

    // set marker for returning to
    returnLabel.marker
  ];
}

function return_() {
  throw new Error("return not implemented yet");
}

function translateLine(tokens, className) {
  if (tokens[0] === 'push') {
    return push(tokens[1], tokens[2], className);
  } else if (tokens[0] === 'pop') {
    return pop(tokens[1], tokens[2], className);
  } else if (tokens[0] === 'label') {
    return label(tokens[1]);
  } else if (tokens[0] === 'goto') {
    return goto(tokens[1]);
  } else if (tokens[0] === 'if-goto') {
    return ifGoto(tokens[1], tokens[2]);
  } else if (tokens[0] === 'function') {
    return function_(tokens[1], tokens[2]);
  } else if (tokens[0] === 'call') {
    return call(tokens[1], tokens[2], className);
  } else if (tokens[0] === 'return') {
    return return_();
  } else if (tokens.length === 1) {
    return operations[tokens[0]]();
  } else {
    throw new Error(tokens[0] + " not implemented yet");
  }
}

function flatMap(arr, func) {
  return _.flatten(arr.map(func));
}

function main() {
  const inputFilePath = process.argv[2];
  const isDirectory = fs.lstatSync(inputFilePath).isDirectory();

  let outputFilePath;
  let vmFiles;
  if (isDirectory) {
    const filename = path.parse(inputFilePath).name + ".asm";
    outputFilePath = path.join(inputFilePath, filename);
    vmFiles = fs.readdirSync(inputFilePath).filter(file =>
        file.match(/\.vm$/)
      ).map(file =>
        path.join(inputFilePath, file)
      );
  } else {
    outputFilePath = inputFilePath.replace(/\.\w+$/, '.asm');
    vmFiles = [inputFilePath];
  }

  const bootstrapCode = [
    "@256",
    "D=A",
    "@SP",
    "M=D",
    "@Sys.init",
    "0;JMP"
  ];

  const allFilesProcessed = flatMap(vmFiles, inputFile => {
    const className = path.basename(inputFile).replace(/\.\w+$/, '');
    const file = fs.readFileSync(inputFile, 'utf8');

    // remove comments and whitespace
    const lines = file.split("\n").map(line => {
      return line.replace(/\/\/.*/, '').trim();
    }).filter(line => line.length);


    const processed = flatMap(lines, line => {
      const tokens = line.split(" ");

      const outputForLine = [
        "// " + line
      ];

      // always add commented line
      return outputForLine.concat(translateLine(tokens, className));
    });

    return processed;
  });


  const output = bootstrapCode.concat(allFilesProcessed).join("\n");

  if (process.argv[3] == '--debug') {
    console.log(output);
  } else {
    fs.writeFileSync(outputFilePath, output);
  }
}

main();
