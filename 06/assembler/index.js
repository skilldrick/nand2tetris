#! /usr/bin/env node

var fs = require('fs');

const file = fs.readFileSync(process.argv[2], 'utf8');

// remove comments and whitespace
const lines =
  file.split("\n").map(line => {
    return line.replace(/\/\/.*/, '').trim();
  }).filter(line => line.length);


function pad(num, length) {
  const missing0s = length - num.length;
  return (new Array(missing0s + 1)).join("0") + num;
}

function a(num) {
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

const assembled = lines.map(line => {
  if (line[0] == '@') {
    return a(+line.slice(1));
  } else {
    return c(line);
  }
});

console.log(assembled.join("\n"));
