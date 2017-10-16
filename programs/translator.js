#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

const inputFilePath = process.argv[2];
const outputFilePath = inputFilePath.replace(/\.\w+$/, '.asm');
const className = path.basename(inputFilePath).replace(/\.\w+$/, '');
const file = fs.readFileSync(inputFilePath, 'utf8');

// remove comments and whitespace
const lines = file.split("\n").map(line => {
  return line.replace(/\/\/.*/, '').trim();
}).filter(line => line.length);


var labelIndex = 0;
function generateNewLabel() {
  const id = ++labelIndex;

  return {
    address: "@LABEL" + id,
    marker: "(LABEL" + id + ")"
  };
}

function staticAddress(value) {
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

function push(type, value) {
  // push D register to stack
  const pushD = [
    '@SP',
    'A=M',
    'M=D',
    '@SP',
    'M=M+1'
  ];

  if (type === 'constant') {
    return [
      // set D to value
      '@' + value,
      'D=A',
    ].concat(pushD);

  } else if (type === 'static') {
    return [
      // set D to *@File.value
      staticAddress(value),
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

function pop(type, value) {
  const popD = [
    // Decrement SP and load top value in D
    '@SP',
    'AM=M-1',
    'D=M',
  ];

  if (type === 'static') {
    return popD.concat([
      // Store D in static address
      staticAddress(value),

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

function translateLine(tokens) {
  if (tokens.length === 1) {
    return operations[tokens[0]]();
  } else if (tokens[0] === 'push') {
    return push(tokens[1], tokens[2]);
  } else if (tokens[0] === 'pop') {
    return pop(tokens[1], tokens[2]);
  } else {
    throw new Error(tokens[0] + " not implemented yet");
  }
}

const processed = _.flatten(lines.map(line => {
  const tokens = line.split(" ");

  const outputForLine = [
    "// " + line
  ];

  // always add commented line
  return outputForLine.concat(translateLine(tokens));
}));

const output = processed.join("\n");

if (process.argv[3] == '--debug') {
  console.log(output);
} else {
  fs.writeFileSync(outputFilePath, output);
}
