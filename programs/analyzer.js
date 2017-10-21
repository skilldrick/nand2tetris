#! /usr/bin/env node

var tokenize = require('./tokenizer.js');
var parse = require('./parser.js');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');

function openingTag(name) {
  return "<" + name + ">";
}

function closingTag(name) {
  return "</" + name + ">";
}

function space(indent) {
  return Array(indent + 1).join(" ");
}

function convertToXml(arr, indent = 0) {
  return _.flatMap(arr, el => {
    if (el.content !== undefined) {
      return [
        space(indent) + openingTag(el.type),
        ...convertToXml(el.content, indent + 2),
        space(indent) + closingTag(el.type)
      ];
    } else {
      return [
        space(indent) + openingTag(el.type) + " " + el.value + " " + closingTag(el.type)
      ];
    }
  });
}

function main() {
  const debug = process.argv[3] == '--debug';
  const inputFilePath = process.argv[2];
  const isDirectory = fs.lstatSync(inputFilePath).isDirectory();

  let jackFiles;
  if (isDirectory) {
    jackFiles = fs.readdirSync(inputFilePath).filter(file =>
        file.match(/\.jack$/)
      ).map(file =>
        path.join(inputFilePath, file)
      );
  } else {
    jackFiles = [inputFilePath];
  }

  const debugOutput = jackFiles.map(filePath => {
    const outputFilePath = filePath.replace(/\.\w+$/, '-mine.xml');
    const file = fs.readFileSync(filePath, 'utf8');

    const tokens = tokenize(file);

    const processed = [
      { type: "class", content: parse(tokens) }
    ];

    const output = convertToXml(processed).join("\n");

    if (debug) {
      console.log(output);
    } else {
      fs.writeFileSync(outputFilePath, output);
    }
  });
}

main();
