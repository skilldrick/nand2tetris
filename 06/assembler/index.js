#! /usr/bin/env node

var fs = require('fs');

const file = fs.readFileSync(process.argv[2], 'utf8');

// remove comments and whitespace
const lines =
  file.split("\n").map(line => {
    return line.replace(/\/\/.*/, '').trim();
  }).filter(line => line.length);


var currentMemoryLocation = 16;
var labelCount = 0;
const symbols = {
  SP: 0,
  LCL: 1,
  ARG: 2,
  THIS: 3,
  THAT: 4,
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
  R5: 5,
  R6: 6,
  R7: 7,
  R8: 8,
  R9: 9,
  R10: 10,
  R11: 11,
  R12: 12,
  R13: 13,
  R14: 14,
  R15: 15,
  SCREEN: 16384,
  KBD: 24576
};

const linesWithoutLabels = lines.filter((line, index) => {
  const match = line.match(/\(([a-zA-Z0-9_.$]*)\)/);

  if (match) {
    labelCount++;
    symbols[match[1]] = index - labelCount + 1; // calculate line number of label
    return false; // remove the label
  } else {
    return true;
  }
});


function pad(num, length) {
  const missing0s = length - num.length;
  return (new Array(missing0s + 1)).join("0") + num;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getSymbol(symbol) {
  if (symbols[symbol] === undefined) {
    symbols[symbol] = currentMemoryLocation++;
  }

  return symbols[symbol];
}

function a(numOrSymbol) {
  const num = isNumeric(numOrSymbol) ? +numOrSymbol : +getSymbol(numOrSymbol);
  // A commands start with 0
  // Then convert num to binary padded to 15 bits
  return "0" + pad(num.toString(2), 15);
}

const comps = {
  '0':   "0101010",
  '1':   "0111111",
  '-1':  "0111010",
  'D':   "0001100",
  'A':   "0110000",
  'M':   "1110000",
  '!D':  "0001101",
  '!A':  "0110001",
  '!M':  "1110001",
  'D+1': "0011111",
  'A+1': "0110111",
  'M+1': "1110111",
  'D-1': "0001110",
  'A-1': "0110010",
  'M-1': "1110010",
  'D+A': "0000010",
  'D+M': "1000010",
  'D-A': "0010011",
  'D-M': "1010011",
  'A-D': "0000111",
  'M-D': "1000111",
  'D&A': "0000000",
  'D&M': "1000000",
  'D|A': "0010101",
  'D|M': "1010101"
};

const dests = {
  null:  "000",
  'M':   "001",
  'D':   "010",
  'MD':  "011",
  'A':   "100",
  'AM':  "101",
  'AD':  "110",
  'AMD': "111"
};

const jumps = {
  null:  "000",
  'JGT': "001",
  'JEQ': "010",
  'JGE': "011",
  'JLT': "100",
  'JNE': "101",
  'JLE': "110",
  'JMP': "111"
};

function c(line) {
  const match = line.match(/(.*=)?([^;]*)?(;.*)?/)

  const dest = match[1] ? match[1].slice(0, -1) : null;
  const comp = match[2];
  const jump = match[3] ? match[3].slice(1) : null;

  return "111" + comps[comp] + dests[dest] + jumps[jump];
}

const assembled = linesWithoutLabels.map(line => {
  if (line[0] == '@') {
    return a(line.slice(1));
  } else {
    return c(line);
  }
});

console.log(assembled.join("\n"));
