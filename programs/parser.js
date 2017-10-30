const symbolTable = require('./symbolTable.js');
const _ = require('lodash');


function parse(tokens) {
  const unaryOperators = ['-', '~'];
  const binaryOperators = ['+', '-', '*', '/', '&', '|', '<', '>', '='];
  const returnTypes = ['void', 'int', 'char', 'boolean'];

  let i = 0;

  let currentClassSymbolTable, currentSubroutineSymbolTable;
  let mostRecentTypeDefinition; // super hacky but (shrug)
  let mostRecentSubroutineType; // unused

  function getSymbolFallback(name) {
    if (name[0].match(/[A-Z]/)) {
      return { name: name, kind: 'class' };
    } else {
      return { name: name, kind: 'method' };
    }
  }

  function getSymbol(name) {
    return currentSubroutineSymbolTable.get(name) ||
      currentClassSymbolTable.get(name) ||
      getSymbolFallback(name);
  }

  function moreTokens() {
    return i < tokens.length;
  }

  function getToken() {
    return tokens[i];
  }

  function peekToken() {
    return tokens[i + 1];
  }

  function nextTypeIs(type) {
    return getToken().type === type;
  }

  function nextValueIs(value) {
    return getToken().value === value;
  }

  function nextValueIsOneOf(values) {
    return values.includes(getToken().value);
  }

  function consumeAlternatives(specs) {
    const token = tokens[i++];

    function matchesAlternative(spec) {
      const typeMatches = !spec.type || spec.type === token.type;

      const valueMatches = !spec.value ||
        spec.value === token.value ||
        (Array.isArray(spec.value) && spec.value.includes(token.value));

      return typeMatches && valueMatches;
    }

    const matches = specs.some(matchesAlternative);

    if (!matches) {
      console.log("Context:\n", tokens.slice(i - 3, i + 2));
      throw new Error(
        "Expected " + JSON.stringify(token) + " to match: " + JSON.stringify(specs)
      );
    }

    return token;
  }

  function consume(type, value) {
    return consumeAlternatives([{ type: type, value: value}]);
  }

  function consumeKeyword(expected) {
    return consume('keyword', expected);
  }

  function consumeIdentifier(category, isDefinition) {
    const token = consume('identifier', null);

    if (isDefinition) {
      if (category === 'class') {
        currentClassSymbolTable = symbolTable(token.value);
      } else if (category === 'subroutine') {
        currentSubroutineSymbolTable = symbolTable(token.value);
        //currentClassSymbolTable.add(token.value, mostRecentSubroutineType.value, category);
      } else if (category === 'static' || category === 'field') {
        currentClassSymbolTable.add(token.value, mostRecentTypeDefinition, category);
      } else {
        currentSubroutineSymbolTable.add(token.value, mostRecentTypeDefinition, category);
      }
    } else {
      let symbol = getSymbol(token.value);
      Object.assign(token, symbol);
    }

    return token;
  }

  function consumeIdentifierOrThis(category) {
    if (nextTypeIs('keyword')) {
      return consumeKeyword('this');
    } else {
      return consumeIdentifier(category, false);
    }
  }

  function consumeSymbol(expected) {
    return consume('symbol', expected);
  }

  function consumeType() {
    const type = consumeAlternatives([
      { type: 'keyword', value: returnTypes },
      { type: 'identifier', value: null }
    ]);

    mostRecentTypeDefinition = type.value;

    return type;
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

  // (, func())*
  function consumeZeroOrMoreListItems(func) {
    return zeroOrMoreTimes(() => {
      if (nextValueIs(',')) {
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
    if (nextValueIsOneOf(varTypes)) {
      let varType = getToken().value;

      return {
        type: type,
        content: [
          consumeKeyword(varTypes),
          consumeType(),
          consumeIdentifier(varType, true),
          ...consumeZeroOrMoreListItems(() =>
            [
              consumeIdentifier(varType, true)
            ]
          ),
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
    function consumeParameterListContent() {
      // empty parameter list
      if (nextValueIs(')')) {
        return [];
      } else {
        return [
          consumeType(),
          consumeIdentifier('argument', true),
          ...consumeZeroOrMoreListItems(() =>
            [
              consumeType(),
              consumeIdentifier('argument', true)
            ]
          )
        ];
      }
    }

    return {
      type: 'parameterList',
      content: consumeParameterListContent()
    }
  }

  function consumeOptionalArraySubscript() {
    if (nextValueIs('[')) {
      return [
        consumeSymbol('['),
        consumeExpression(),
        consumeSymbol(']')
      ];
    } else {
      return [];
    }
  }

  function consumeSubroutineCall() {
    function consumeOptionalMethodDereference() {
      if (nextValueIs('.')) {
        return [
          consumeSymbol('.'),
          consumeIdentifier('subroutine', false)
        ];
      } else {
        return [];
      }
    }

    return [
      consumeIdentifier(null, false),
      ...consumeOptionalMethodDereference(),
      consumeSymbol('('),
      consumeExpressionList(),
      consumeSymbol(')')
    ]
  }

  function consumeUnaryTerm() {
    return [
      consumeSymbol(unaryOperators),
      consumeTerm()
    ];
  }

  function consumeArrayAccess() {
    return [
      consumeIdentifier(null, false),
      ...consumeOptionalArraySubscript()
    ];
  }

  function consumeParenthesizedExpression() {
    return [
      consumeSymbol('('),
      consumeExpression(),
      consumeSymbol(')')
    ];
  }

  function consumeTerm() {
    function consumeTermContent() {
      if (nextValueIsOneOf(unaryOperators)) {
        return consumeUnaryTerm();
      } else if (nextTypeIs('integerConstant')) {
        return [consume('integerConstant', null)];
      } else if (nextTypeIs('stringConstant')) {
        return [consume('stringConstant', null)];
      } else if (nextValueIsOneOf(['true', 'false', 'null', 'this'])) {
        return [consumeKeyword(null)];
      } else if (nextValueIs('(')) {
        return consumeParenthesizedExpression();
      } else if (nextTypeIs('identifier') || nextValueIs('this')) {
        if (peekToken().value === '[') {
          return consumeArrayAccess();
        } else if (peekToken().value === '.' || peekToken().value === '(') {
          return consumeSubroutineCall();
        } else {
          return [consumeIdentifierOrThis(null)];
        }
      } else {
        throw new Error('Unknown term');
      }
    }

    return {
      type: 'term',
      content: consumeTermContent()
    };
  }

  function consumeOperator() {
    return consumeSymbol(binaryOperators);
  }

  function consumeExpression() {
    function consumeOptionalOperatorAndTerm() {
      if (nextValueIsOneOf(binaryOperators)) {
        return [
          consumeOperator(),
          consumeTerm()
        ];
      } else {
        return [];
      }
    }

    return {
      type: 'expression',
      content: [
        consumeTerm(),
        ...consumeOptionalOperatorAndTerm()
      ]
    };
  }

  function consumeExpressionList() {
    function consumeExpressionListContent() {
      if (nextValueIs(')')) {
        return []
      } else {
        return [
          consumeExpression(),
          ...consumeZeroOrMoreListItems(() => [ consumeExpression() ])
        ]
      }
    }

    return {
      type: 'expressionList',
      content: consumeExpressionListContent()
    };
  }

  function consumeLetStatement() {
    return {
      type: 'letStatement',
      content: [
        consumeKeyword('let'),
        consumeIdentifier('var', false),
        ...consumeOptionalArraySubscript(),
        consumeSymbol('='),
        consumeExpression(),
        consumeSymbol(';')
      ]
    };
  }

  function consumeIfStatement() {
    function consumeOptionalElseClause() {
      if (nextValueIs('else')) {
        return [
          consumeKeyword('else'),
          consumeSymbol('{'),
          consumeStatements(),
          consumeSymbol('}')
        ];
      } else {
        return [];
      }
    }

    return {
      type: 'ifStatement',
      content: [
        consumeKeyword('if'),
        consumeSymbol('('),
        consumeExpression(),
        consumeSymbol(')'),
        consumeSymbol('{'),
        consumeStatements(),
        consumeSymbol('}'),
        ...consumeOptionalElseClause()
      ]
    };
  }

  function consumeWhileStatement() {
    return {
      type: 'whileStatement',
      content: [
        consumeKeyword('while'),
        consumeSymbol('('),
        consumeExpression(),
        consumeSymbol(')'),
        consumeSymbol('{'),
        consumeStatements(),
        consumeSymbol('}'),
      ]
    };
  }

  function consumeDoStatement() {
    return {
      type: 'doStatement',
      content: [
        consumeKeyword('do'),
        ...consumeSubroutineCall(),
        consumeSymbol(';')
      ]
    };
  }

  function consumeReturnStatement() {
    function consumeOptionalReturnExpression() {
      if (nextValueIs(';')) {
        return [];
      } else {
        return [
          consumeExpression(),
        ];
      }
    }

    return {
      type: 'returnStatement',
      content: [
        consumeKeyword('return'),
        ...consumeOptionalReturnExpression(),
        consumeSymbol(';')
      ]
    };
  }

  function consumeStatement() {
    const statementTypes = {
      'let': consumeLetStatement,
      'if': consumeIfStatement,
      'while': consumeWhileStatement,
      'do': consumeDoStatement,
      'return': consumeReturnStatement
    };

    const consumeNextStatement = statementTypes[getToken().value];

    if (consumeNextStatement) {
      return consumeNextStatement();
    } else {
      return null;
    }
  }

  function consumeStatements() {
    return {
      type: 'statements',
      content: zeroOrMoreTimes(consumeStatement)
    }
  }

  function consumeSubroutineBody() {
    return {
      type: 'subroutineBody',
      content: [
        consumeSymbol('{'),
        ...zeroOrMoreTimes(consumeSubroutineVarDec),
        consumeStatements(),
        consumeSymbol('}')
      ]
    };
  }

  function consumeSubroutineDec() {
    const subroutineTypes = ['constructor', 'function', 'method'];

    function consumeSubroutineReturnType() {
      return consumeAlternatives([
        { type: 'keyword', value: returnTypes },
        { type: 'identifier', value: null }
      ]);
    }

    if (nextValueIsOneOf(subroutineTypes)) {
      mostRecentSubroutineType = consumeKeyword(subroutineTypes);

      return {
        type: 'subroutineDec',
        content: [
          mostRecentSubroutineType,
          consumeSubroutineReturnType(),
          consumeIdentifier('subroutine', true),
          consumeSymbol('('),
          consumeParameterList(),
          consumeSymbol(')'),
          consumeSubroutineBody()
        ]
      };
    } else {
      return null;
    }
  }

  function consumeClass() {
    const cls = {
      type: 'class',
      content: [
        consumeKeyword('class'),
        consumeIdentifier('class', true),
        consumeSymbol('{'),
        ...zeroOrMoreTimes(consumeClassVarDec),
        ...zeroOrMoreTimes(consumeSubroutineDec),
        consumeSymbol('}'),
      ]
    };

    cls.symbolTable = currentClassSymbolTable.table;

    return cls;
  }

  let parseTree = [consumeClass()];

  return parseTree;
}

module.exports = parse;
