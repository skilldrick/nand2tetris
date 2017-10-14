#! /usr/bin/env node

var fs = require('fs');

const inputFileName = process.argv[2];
const outputFileName = inputFileName.replace(/\.\w+$/, '.asm');
const file = fs.readFileSync(inputFileName, 'utf8');

// remove comments and whitespace
const lines = file.split("\n").map(line => {
  return line.replace(/\/\/.*/, '').trim();
}).filter(line => line.length);





const output = lines.join("\n");

if (process.argv[3] == '--debug') {
  console.log(output);
} else {
  fs.writeFileSync(outputFileName, output);
}
