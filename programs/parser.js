var _ = require('lodash');


function parse(tokens) {
  let i = 0;

  function moreTokens() {
    return i < tokens.length;
  }

  function getToken() {
    return tokens[i];
  }

  function peekToken() {
    return tokens[i + 1];
  }

  function consumeAlternatives(specs) {
    const token = tokens[i++];

    function matchesAlternative(spec) {
      const typeMatches = !spec.type || spec.type === token.type;
      const valueMatches = !spec.value || spec.value === token.value;
      return typeMatches && valueMatches;
    }

    const matches = specs.some(matchesAlternative);

    if (!matches) {
      throw new Error(
        "Expected " + JSON.stringify(token) + " to match: " + JSON.stringify(specs)
      );
    }

    return token;
  }

  function consume(type, value) {
    if (Array.isArray(value)) {
      return consumeAlternatives(
        value.map(v => ({ type: type, value: v }))
      );
    } else {
      return consumeAlternatives([{ type: type, value: value}]);
    }
  }

  function consumeKeyword(expected) {
    return consume('keyword', expected);
  }

  function consumeIdentifier() {
    return consume('identifier', null);
  }

  function consumeSymbol(expected) {
    return consume('symbol', expected);
  }

  function consumeType() {
    return consume(keyword, ['int', 'char', 'boolean'])
  }

  function consumeClassVarDec() {
    const nextTokenValue = getToken().value;
    if (nextTokenValue === 'static' || nextTokenValue === 'field') {
      return {
        type: 'classVarDec',
        content: [
          consumeKeyword(['static', 'field']),
          consumeAlternatives([
            { type: 'keyword', value: 'int' },
            { type: 'keyword', value: 'char' },
            { type: 'keyword', value: 'boolean' },
            { type: 'identifier', value: null }
          ]),
          consumeIdentifier(),
          ...zeroOrMoreTimes(() => {
            if (getToken().value === ',') {
              return [
                consumeSymbol(','),
                consumeIdentifier()
              ];
            } else {
              return null;
            }
          }),
          consumeSymbol(';')
        ]
      };
    } else {
      return null;
    }
  }

  function zeroOrMoreTimes(func) {
    let output = [];

    // As long as func returns a result, add it to the output
    while(true) {
      let nextResult = func();

      if (nextResult) {
        if (Array.isArray(nextResult)) {
          output = output.concat(nextResult);
        } else {
          output.push(nextResult);
        }
      } else {
        return output;
      }
    }
  }

  function parseClass() {
    return [
      consumeKeyword('class'),
      consumeIdentifier(),
      consumeSymbol('{'),
      ...zeroOrMoreTimes(consumeClassVarDec),
    ];
  }

  let parseTree = [
    { type: 'class', content: parseClass() }
  ];

  return parseTree;
}

module.exports = parse;
