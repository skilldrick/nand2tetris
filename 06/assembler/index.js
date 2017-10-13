#! /usr/bin/env node

var fs = require('fs');

const file = fs.readFileSync(process.argv[2], 'utf8');

// remove comments and whitespace
const lines =
  file.split("\n").map(line => {
    return line.replace(/\/\/.*/, '').trim();
  }).filter(line => line.length);

console.log(lines);
