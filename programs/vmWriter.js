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

  const unaryOperators = ['-', '~'];

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

  // terminal write* methods

  function writeFunction(name, nLocals) {
    return ["function", name, nLocals].join(" ");
  }

  function writeCall(name, nArgs) {
    return ["call", name, nArgs].join(" ");
  }

  function writePush(location, value) {
    return ["push", location, value].join(" ");
  }

  function writeOp(op) {
    return binaryOperators[op];
  }

  function writeReturn() {
    return "return";
  }

  // non-terminal write* methods

  function writeTerm(term) {
    if (term[0].type === 'integerConstant') {
      // integer constant
      return [writePush('constant', term[0].value)];
    } else if (unaryOperators.includes(term[0].value)) {
      // unary operator
      assert(term.length === 2);
      return writeUnaryExpression(term);
    } else if (term[0].value === '(') {
      // parenthesized expression
      assert(term.length === 3 && term[2].value === ')');
      return writeExpression(term[1].content);
    } else {
      return [];
    }
  }

  function writeBinaryExpression(expr) {
    return [
      ...writeTerm(expr[0].content),
      ...writeTerm(expr[2].content),
      writeOp(expr[1].value)
    ];
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
      writeTerm(expr[1]),
      writeOp(expr[0].value)
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
      pp('expr', expr);
      assert(false);
    }
  }

  function writeLetStatement(statementContent) {
    
  }

  function writeIfStatement(statementContent) {
    
  }

  function writeWhileStatement(statementContent) {
    
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
    const bodyContent = subroutineContent[6].content[1].content;

    const bodyVarDecs = filterType(bodyContent, 'varDec');
    const bodyStatements = filterType(bodyContent, Object.keys(statementTypes));

    return [
      writeFunction(fullName, bodyVarDecs.length),
      ..._.flatMap(bodyStatements, writeStatement)
    ];
  }

  function writeClass(classContent) {
    className = classContent[1].value;
    const subroutines = filterType(classContent, 'subroutineDec');
    return _.flatMap(subroutines, subroutine => writeSubroutine(subroutine.content));
  }

  return writeClass(parseTree[0].content);
}

module.exports = vmWriter;
