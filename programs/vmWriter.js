const _ = require('lodash');

function vmWriter(parseTree) {
  let className; // might not need this?

  const statementTypes = {
    'letStatement': writeLetStatement,
    'ifStatement': writeIfStatement,
    'whileStatement': writeWhileStatement,
    'doStatement': writeDoStatement,
    'returnStatement': writeReturnStatement
  };

  const unaryOperators = {
    '-': 'neg',
    '~': 'not'
  };

  const binaryOperators = {
    '+': 'add',
    '-': 'sub',
    '&': 'and',
    '|': 'or',
    '<': 'lt',
    '>': 'gt',
    '=': 'eq'
  };

  const nonBuiltInOperators = {
    '*': 'Math.multiply',
    '/': 'Math.divide',
  };

  const booleans = ['true', 'false'];

  function assert(bool) {
    if (!bool) {
      throw new Error("Assertion failed");
    }
  }

  function pp(label, x) {
    console.log(label + " " + JSON.stringify(x, null, 2));
  }

  function filterType(content, type) {
    if (Array.isArray(type)) {
      return content.filter(el => type.includes(el.type));
    } else {
      return content.filter(el => el.type === type);
    }
  }

  function findType(content, type) {
    return (filterType(content, type) || [])[0];
  }

  // terminal write* methods

  function writeFunction(name, nLocals) {
    return ["function", name, nLocals].join(" ");
  }

  function writeCall(name, nArgs) {
    return ["call", name, nArgs].join(" ");
  }

  function writePush(segment, index) {
    return ["push", segment, index].join(" ");
  }

  function writePop(segment, index) {
    return ["pop", segment, index].join(" ");
  }

  function writeUnaryOp(op) {
    return unaryOperators[op];
  }

  function writeBinaryOp(op) {
    return binaryOperators[op];
  }

  function writeReturn() {
    return "return";
  }

  // non-terminal write* methods

  //TODO: dedupe with writeDoStatement
  function writeMethodCall(content) {
    pp('method', content);
    const methodName = content.slice(0, -3).map(el => el.value).join("");
    const fullMethodName = (methodName.indexOf('.') === -1) ? className + "." + methodName : methodName;
    const argsContent = content[content.length - 2].content;
    const args = argsContent.filter(el => el.type === "expression");

    return [
      ..._.flatMap(args, arg => writeExpression(arg.content)),
      writeCall(fullMethodName, args.length)
    ];
  }

  function writeTerm(term) {
    if (term[0].type === 'integerConstant') {
      // integer constant
      return [
        writePush('constant', term[0].value)
      ];
    } else if (booleans.includes(term[0].value)) {
      if (term[0].value === 'true') {
        return [
          writePush('constant', 0),
          writeUnaryOp('~')
        ];
      } else {
        return [
          writePush('constant', 0)
        ];
      }
    } else if (unaryOperators.hasOwnProperty(term[0].value)) {
      // unary operator
      assert(term.length === 2);
      return writeUnaryExpression(term);
    } else if (term[0].value === '(') {
      // parenthesized expression
      assert(term.length === 3 && term[2].value === ')');
      return writeExpression(term[1].content);
    } else if (term[0].kind === 'class') {
      assert(term[1].value === '.' && term.length === 6);
      return writeMethodCall(term);
    } else if (term[0].kind) {
      return writePush(term[0].kind, term[0].index);
    } else {
      pp('failed term', term);
      assert(false);
      return [];
    }
  }

  function writeBinaryExpression(expr) {
    return [
      ...writeTerm(expr[0].content),
      ...writeTerm(expr[2].content),
      writeBinaryOp(expr[1].value)
    ];
    h
  }

  function writeBinaryExpressionWithFunc(expr) {
    return [
      ...writeTerm(expr[0].content),
      ...writeTerm(expr[2].content),
      writeCall(nonBuiltInOperators[expr[1].value], 2)
    ];
  }

  function writeUnaryExpression(expr) {
    return [
      ...writeTerm(expr[1].content),
      writeUnaryOp(expr[0].value)
    ];
  }

  function writeExpression(expr) {
    if (expr.length === 1) {
      return writeTerm(expr[0].content);
    } else if (binaryOperators.hasOwnProperty(expr[1].value)) {
      assert(expr.length === 3);
      return writeBinaryExpression(expr);
    } else if (nonBuiltInOperators.hasOwnProperty(expr[1].value)) {
      assert(expr.length === 3);
      return writeBinaryExpressionWithFunc(expr);
    } else {
      pp('failed expr', expr);
      assert(false);
    }
  }

  function writeLetStatement(statementContent) {
    const variable = statementContent[1];
    const variableKind = variable.kind;
    const variableIndex = variable.index;

    const expr = statementContent[3].content;

    return [
      ...writeExpression(expr),
      writePop(variableKind, variableIndex)
    ];
  }

  function writeIfStatement(statementContent) {
    
  }

  function writeWhileStatement(statementContent) {
    // TODO: next
  }

  function writeDoStatement(statementContent) {
    // slice the `do` off the beginning and the `(`, expression list, `)`, and `;` off the end
    const methodName = statementContent.slice(1, -4).map(el => el.value).join("");
    const fullMethodName = (methodName.indexOf('.') === -1) ? className + "." + methodName : methodName;
    const argsContent = statementContent[statementContent.length - 3].content;
    const args = argsContent.filter(el => el.type === "expression");

    return [
      ..._.flatMap(args, arg => writeExpression(arg.content)),
      writeCall(fullMethodName, args.length)
    ];
  }

  function writeReturnStatement(statementContent) {
    let push;
    if (statementContent[1].value === ';') {
      // void return
      push = [writePush('constant', 0)];
    } else {
      push = writeExpression(statementContent[1].content);
    }

    return [
      ...push,
      writeReturn()
    ];
  }

  function writeStatement(statement) {
    return statementTypes[statement.type](statement.content);
  }

  function writeSubroutine(subroutineContent) {
    const returnType = subroutineContent[1];
    const name = subroutineContent[2].value;
    const fullName = className + "." + name;
    const parameters = subroutineContent[4]; // probably don't need
    const bodyContent = subroutineContent[6].content;

    const bodyVarDecs = findType(bodyContent, 'varDec').content;
    const bodyStatements = findType(bodyContent, 'statements').content;

    return [
      writeFunction(fullName, bodyVarDecs.length),
      ..._.flatMap(bodyStatements, writeStatement)
    ];
  }

  function writeClass(classContent) {
    className = classContent[1].value;
    const subroutines = filterType(classContent, 'subroutineDec').slice(0, 2);
    return _.flatMap(subroutines, subroutine => writeSubroutine(subroutine.content));
  }

  return writeClass(parseTree[0].content);
}

module.exports = vmWriter;
