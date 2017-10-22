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
      const valueMatches = !spec.value || spec.value === token.value;
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
    return consumeAlternatives([
      { type: 'identifier', value: null },
      // identifier can be 'this' in many circumstances
      { type: 'keyword', value: 'this' },
    ]);
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
      return {
        type: type,
        content: [
          consumeKeyword(varTypes),
          consumeType(),
          consumeIdentifier(),
          ...consumeZeroOrMoreListItems(() =>
            [
              consumeIdentifier()
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
          consumeIdentifier(),
          ...consumeZeroOrMoreListItems(() =>
            [
              consumeType(),
              consumeIdentifier()
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
          consumeIdentifier()
        ];
      } else {
        return [];
      }
    }

    return [
      consumeIdentifier(),
      ...consumeOptionalMethodDereference(),
      consumeSymbol('('),
      consumeExpressionList(),
      consumeSymbol(')')
    ]
  }

  function consumeTerm() {
    return {
      type: 'term',
      content: [
        // TODO: include other expressions
        consumeIdentifier()
      ]
    };
  }

  function consumeExpression() {
    function consumeOptionalOperatorAndTerm() {
      const binaryOperators = ['+', '-', '*', '/', '&', '|', '<', '>', '='];

      if (nextValueIsOneOf(binaryOperators)) {
        return [
          consumeSymbol(binaryOperators),
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
        consumeIdentifier(),
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
        { type: 'keyword', value: 'void' },
        { type: 'identifier', value: null }
      ]);
    }

    if (nextValueIsOneOf(subroutineTypes)) {
      return {
        type: 'subroutineDec',
        content: [
          consumeKeyword(subroutineTypes),
          consumeSubroutineReturnType(),
          consumeIdentifier(),
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
    return {
      type: 'class',
      content: [
        consumeKeyword('class'),
        consumeIdentifier(),
        consumeSymbol('{'),
        ...zeroOrMoreTimes(consumeClassVarDec),
        ...zeroOrMoreTimes(consumeSubroutineDec),
        consumeSymbol('}'),
      ]
    };
  }

  let parseTree = [consumeClass()];

  return parseTree;
}

module.exports = parse;
