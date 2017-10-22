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
    return consumeAlternatives([
      { type: 'keyword', value: 'int' },
      { type: 'keyword', value: 'char' },
      { type: 'keyword', value: 'boolean' },
      { type: 'identifier', value: null }
    ]);
  }

  // (, func())*
  function consumeZeroOrMoreListItems(func) {
    return zeroOrMoreTimes(() => {
      if (getToken().value === ',') {
        return [
          consumeSymbol(','),
          ...func()
        ];
      } else {
        return null;
      }
    });
  }

  function consumeVarDec(type, varTypes) {
    const nextTokenValue = getToken().value;
    if (varTypes.includes(nextTokenValue)) {
      return {
        type: type,
        content: [
          consumeKeyword(varTypes),
          consumeType(),
          consumeIdentifier(),
          ...consumeZeroOrMoreListItems(() => {
            return [
              consumeIdentifier()
            ];
          }),
          consumeSymbol(';')
        ]
      };
    } else {
      return null;
    }
  }

  function consumeClassVarDec() {
    return consumeVarDec('classVarDec', ['static', 'field']);
  }

  function consumeSubroutineVarDec() {
    return consumeVarDec('varDec', ['var']);
  }

  function consumeParameterList() {
    // empty parameter list
    if (getToken().value === ')') {
      return [];
    } else {
      return [
        {
          type: 'parameterList',
          content: [
            consumeType(),
            consumeIdentifier(),
            ...consumeZeroOrMoreListItems(() => {
              return [
                consumeType(),
                consumeIdentifier()
              ];
            })
          ]
        }
      ];
    }
  }

  function consumeStatement() {
    return null;
  }

  function consumeSubroutineBody() {
    return {
      type: 'subroutineBody',
      content: [
        consumeSymbol('{'),
        ...zeroOrMoreTimes(consumeSubroutineVarDec),
        ...zeroOrMoreTimes(consumeStatement),
        consumeSymbol('}'),
      ]
    };
  }

  function consumeSubroutineDec() {
    const nextTokenValue = getToken().value;
    const subroutineTypes = ['constructor', 'function', 'method'];
    if (subroutineTypes.includes(nextTokenValue)) {
      return {
        type: 'subroutineDec',
        content: [
          consumeKeyword(subroutineTypes),
          consumeAlternatives([
            { type: 'keyword', value: 'void' },
            { type: 'identifier', value: null }
          ]),
          consumeIdentifier(),
          consumeSymbol('('),
          ...consumeParameterList(),
          consumeSymbol(')'),
          consumeSubroutineBody()
        ]
      };
    } else {
      return null;
    }
  }

  function zeroOrMoreTimes(func) {
    let output = [];

    // As long as func returns a result, add it to the output
    // Once func returns null, return the array of output
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
      ...zeroOrMoreTimes(consumeSubroutineDec),
    ];
  }

  let parseTree = [
    { type: 'class', content: parseClass() }
  ];

  return parseTree;
}

module.exports = parse;
