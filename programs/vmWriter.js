// @flow

const _ = require('lodash');

const generateLabel = (() => {
  const labelIndexes = {
    'IF_TRUE': 0,
    'IF_FALSE': 0,
    'IF_END': 0,
    'WHILE_START': 0,
    'WHILE_END': 0
  };

  return function generateLabel(type) {
    return type + labelIndexes[type]++;
  }
})();

function vmWriter(parseTree: {}, className: string): string[] {
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

  function toString(tokens): string {
    return tokens.map(token => {
      if (token.value) {
        return token.value;
      } else {
        return toString(token.content);
      }
    }).join(" ");
  }

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
    const result = filterType(content, type);
    if (result.length === 0) {
      return {};
    } else {
      return result[0];
    }
  }

  function convertSegment(segment: string) {
    const segmentMap = {
      'var': 'local',
      'field': 'this'
    };

    return segmentMap[segment] || segment;
  }

  // terminal write* methods

  function writeFunction(name, nLocals): string {
    return ["function", name, nLocals].join(" ");
  }

  function writeCall(name, nArgs): string {
    return ["call", name, nArgs].join(" ");
  }

  function writePush(segment, index): string {
    return ["push", convertSegment(segment), index].join(" ");
  }

  function writePop(segment, index): string {
    return ["pop", convertSegment(segment), index].join(" ");
  }

  function writeUnaryOp(op): string {
    return unaryOperators[op];
  }

  function writeBinaryOp(op): string {
    return binaryOperators[op];
  }

  function writeReturn(): string {
    return "return";
  }

  function writeLabel(label): string {
    return ["label", label].join(" ");
  }

  function writeGoto(label): string {
    return ["goto", label].join(" ");
  }

  function writeIfGoto(label): string {
    return ["if-goto", label].join(" ");
  }

  // non-terminal write* methods

  function writeMethodCall(name, args): string[] {
    //TODO: need to pass `this`
    return _.flatten([
      _.flatMap(args, arg => writeExpression(arg.content)),
      writeCall(name, args.length)
    ]);
  }

  function writeObjectDotMethodCall(content): string[] {
    const methodName = content.slice(0, -3).map(el => el.value).join("");
    const fullMethodName = (methodName.indexOf('.') === -1) ? className + "." + methodName : methodName;
    const argsContent = content[content.length - 2].content;
    const args = argsContent.filter(el => el.type === "expression");

    return writeMethodCall(fullMethodName, args);
  }

  function writeTerm(term): string[] {
    if (term[0].type === 'integerConstant') {
      // integer constant
      return [
        writePush('constant', term[0].value)
      ];
    } else if (term[0].value === 'true') {
      // true
      return [
        writePush('constant', 1),
        writeUnaryOp('-')
      ];
    } else if (term[0].value === 'false' || term[0].value === 'null') {
      // false and null
      return [
        writePush('constant', 0)
      ];
    } else if (term[0].type === 'keyword' && term[0].value === 'this') {
      return [
        writePush('this', 0)
      ];
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
      return writeObjectDotMethodCall(term);
    } else if (term[0].kind) {
      return [
        writePush(term[0].kind, term[0].index)
      ];
    } else {
      pp('failed term', term);
      assert(false);
      return [];
    }
  }

  function writeBinaryExpression(expr): string[] {
    return _.flatten([
      writeTerm(expr[0].content),
      writeTerm(expr[2].content),
      writeBinaryOp(expr[1].value)
    ]);
  }

  function writeBinaryExpressionWithFunc(expr): string[] {
    return _.flatten([
      writeTerm(expr[0].content),
      writeTerm(expr[2].content),
      writeCall(nonBuiltInOperators[expr[1].value], 2)
    ]);
  }

  function writeUnaryExpression(expr): string[] {
    return _.flatten([
      writeTerm(expr[1].content),
      writeUnaryOp(expr[0].value)
    ]);
  }

  function writeExpression(expr): string[] {
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
      return [];
    }
  }

  function writeLetStatement(statementContent): string[] {
    const variable = statementContent[1];
    const variableKind = variable.kind;
    const variableIndex = variable.index;

    const expr = statementContent[3].content;

    return _.flatten([
      writeExpression(expr),
      writePop(variableKind, variableIndex)
    ]);
  }

  function writeIfStatement(statementContent): string[] {
    const falseLabel = generateLabel('IF_FALSE');
    const endLabel = generateLabel('IF_END');

    const ifCondition = statementContent[2].content;
    const ifBody = statementContent[5].content;

    if (!statementContent[9]) {
      // no else
      return _.flatten([
        writeExpression(ifCondition),
        writeUnaryOp('~'), // negate if condition so we can jump to else if false
        writeIfGoto(endLabel),
        writeStatements(ifBody),
        writeLabel(endLabel)
      ]);
    } else {
      const elseBody = statementContent[9].content;

      return _.flatten([
        writeExpression(ifCondition),
        writeUnaryOp('~'), // negate if condition so we can jump to else if false
        writeIfGoto(falseLabel),
        writeStatements(ifBody),
        writeGoto(endLabel),
        writeLabel(falseLabel),
        writeStatements(elseBody),
        writeLabel(endLabel)
      ]);

    }
  }

  function writeWhileStatement(statementContent): string[] {
    const startLabel = generateLabel('WHILE_START');
    const endLabel = generateLabel('WHILE_END');

    const whileCondition = statementContent[2].content;
    const whileBody = statementContent[5].content;

    return _.flatten([
      writeLabel(startLabel),
      writeExpression(whileCondition),
      writeUnaryOp('~'), // negate while condition so we can jump to end if false
      writeIfGoto(endLabel),
      writeStatements(whileBody),
      writeGoto(startLabel),
      writeLabel(endLabel)
    ]);
  }

  function writeDoStatement(statementContent): string[] {
    // slice the `do` off the beginning and the `(`, expression list, `)`, and `;` off the end
    const methodName = statementContent.slice(1, -4).map(el => el.value).join("");
    const fullMethodName = (methodName.indexOf('.') === -1) ? className + "." + methodName : methodName;
    const argsContent = statementContent[statementContent.length - 3].content;
    const args = argsContent.filter(el => el.type === "expression");

    return writeMethodCall(fullMethodName, args);
  }

  function writeReturnStatement(statementContent): string[] {
    let push;
    if (statementContent[1].value === ';') {
      // void return
      push = [writePush('constant', 0)];
    } else {
      push = writeExpression(statementContent[1].content);
    }

    return _.flatten([
      push,
      writeReturn()
    ]);
  }

  function writeStatement(statement): string[] {
    const str = "// " + toString(statement.content);
    return [str].concat(statementTypes[statement.type](statement.content));
  }

  function writeStatements(statements): string[] {
    return _.flatMap(statements, writeStatement)
  }

  function writeConstructorInit(): string[] {
    const table: { [string]: { kind: string } } = parseTree[0].symbolTable;
    const kinds = Object.keys(table).map(key => table[key].kind);
    const fields = kinds.filter(kind => kind === 'field').length;

    return [
      writePush("const", fields),
      writeCall("Memory.alloc", 1),
      writePop("pointer", 0)
    ];
  }

  function writeSubroutine(subroutineContent): string[] {
    const returnType = subroutineContent[1];
    const name = subroutineContent[2].value;
    const fullName = className + "." + name;
    const bodyContent = subroutineContent[6].content;

    const bodyVarDecs = findType(bodyContent, 'varDec').content || [];
    const bodyStatements = findType(bodyContent, 'statements').content;

    const subroutineType = subroutineContent[0].value;

    return _.flatten([
      writeFunction(fullName, bodyVarDecs.length),
      (subroutineType === 'constructor') ? writeConstructorInit() : [],
      writeStatements(bodyStatements)
    ]);
  }

  function writeClass(classContent): string[] {
    const subroutines = filterType(classContent, 'subroutineDec');
    return _.flatMap(subroutines, subroutine => writeSubroutine(subroutine.content));
  }

  return writeClass(parseTree[0].content);
}

module.exports = vmWriter;
