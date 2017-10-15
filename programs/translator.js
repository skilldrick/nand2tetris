#! /usr/bin/env node

var fs = require('fs');
var _ = require('lodash');

const inputFileName = process.argv[2];
const outputFileName = inputFileName.replace(/\.\w+$/, '.asm');
const file = fs.readFileSync(inputFileName, 'utf8');

// remove comments and whitespace
const lines = file.split("\n").map(line => {
  return line.replace(/\/\/.*/, '').trim();
}).filter(line => line.length);



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

var labelIndex = 0;
function generateNewLabel() {
  const id = ++labelIndex;

  return {
    address: "@LABEL" + id,
    marker: "(LABEL" + id + ")"
  };
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

function push(type, value) {
  if (type === 'constant') {
    return [
      '@' + value,
      'D=A',
      '@SP',
      'A=M',
      'M=D',
      '@SP',
      'M=M+1'
    ];
  } else {
    throw new Error(type + " not implemented yet");
  }
}

function pop(type, value) {
  throw new Error(type + " not implemented yet");
}

function getOutput(tokens) {
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
  return outputForLine.concat(getOutput(tokens));
}));



const output = processed.join("\n");

if (process.argv[3] == '--debug') {
  console.log(output);
} else {
  fs.writeFileSync(outputFileName, output);
}
