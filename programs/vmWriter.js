/* @flow */

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

function vmWriter(parseTree: {}, className: string): Array<string> {
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
    '%': 'String.mod'
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
    if (index == null) {
      throw new Error("Index is undefined");
    }
    return ["push", convertSegment(segment), index].join(" ");
  }

  function writePop(segment, index): string {
    if (index == null) {
      throw new Error("Index is undefined");
    }
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

  function writeFunctionCall(fullName, args): Array<string> {
    return _.flatten([
      _.flatMap(args, arg => writeExpression(arg.content)),
      writeCall(fullName, args.length)
    ]);
  }

  function writeMethodCall(receiver, name, args): Array<string> {
    let receiverName;

    if (receiver.value === 'this') {
      receiverName = className;
    } else {
      receiverName = receiver.type;
    }

    const fullName = receiverName + "." + name;
    const thisArg = {
      type: "expression",
      content: [
        { type: "term", content: [receiver] }
      ]
    };
    const fullArgs = [thisArg].concat(args);

    return _.flatten([
      _.flatMap(fullArgs, arg => writeExpression(arg.content)),
      writeCall(fullName, fullArgs.length)
    ]);

  }

  function writeFunctionCallFromTerm(content): Array<string> {
    const className = content[0].name;
    const functionName = content[2].name;

    const fullName = className + "." + functionName;

    const argsContent = content[content.length - 2].content;
    const args = argsContent.filter(el => el.type === "expression");

    return writeFunctionCall(fullName, args);
  }

  function writeMethodCallWithObject(content): Array<string> {
    const object = content[0];
    const methodName = content[2].name;

    const argsContent = content[content.length - 2].content;
    const args = argsContent.filter(el => el.type === "expression");

    return writeMethodCall(object, methodName, args);
  }

  function writeMethodCallWithoutObject(content): Array<string> {
    const methodName = content[0].name;

    const argsContent = content[content.length - 2].content;
    const args = argsContent.filter(el => el.type === "expression");

    const receiver = { type: 'keyword', value: 'this' };

    return writeMethodCall(receiver, methodName, args);
  }

  function writeStringConstant(string): Array<string> {
    const charAdds = _.flatMap(string.split(''), char => {
      return [
        writePush('constant', char.charCodeAt()),
        writeCall('String.appendChar', 2)
      ];
    });

    return _.flatten([
      writePush('constant', string.length),
      writeCall('String.new', 1),
      charAdds
    ]);
  }

  function writeArrayAccess(term): Array<string> {
    const array = term[0];
    const arrayKind = array.kind;
    const arrayIndex = array.index;
    const arrayOffsetExpression = term[2].content;

    return _.flatten([
      // Add offset to array base address
      writePush(arrayKind, arrayIndex),
      writeExpression(arrayOffsetExpression),
      writeBinaryOp('+'), // now destination address is top of stack

      // pop destination address to that pointer
      writePop('pointer', 1),

      // push value at that 0 to stack
      writePush('that', 0)
    ]);
  }

  function writeTerm(term): Array<string> {
    if (term[0].type === 'integerConstant') {
      // integer constant
      return [
        writePush('constant', term[0].value)
      ];
    } else if (term[0].type === 'stringConstant') {
      return writeStringConstant(term[0].value);
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
        writePush('pointer', 0)
      ];
    } else if (unaryOperators.hasOwnProperty(term[0].value)) {
      // unary operator
      assert(term.length === 2);
      return writeUnaryExpression(term);
    } else if (term[1] && term[1].value === '[') {
      return writeArrayAccess(term);
    } else if (term[0].value === '(') {
      // parenthesized expression
      assert(term.length === 3 && term[2].value === ')');
      return writeExpression(term[1].content);
    } else if (term[0].kind === 'class') {
      assert(term[1].value === '.' && term.length === 6);
      return writeFunctionCallFromTerm(term);
    } else if (term[1] && term[1].value === '.') {
      assert(term[1].value === '.' && term.length === 6);
      return writeMethodCallWithObject(term);
    } else if (term[1] && term[1].value === '(') {
      assert(term.length === 4);
      return writeMethodCallWithoutObject(term);
    } else if (term[0].kind) {
      if (term[0].index == null) {
        throw new Error("No index for term " + JSON.stringify(term[0]));
      }
      return [
        writePush(term[0].kind, term[0].index)
      ];
    } else {
      pp('failed term', term);
      assert(false);
      return [];
    }
  }

  function writeBinaryExpression(expr): Array<string> {
    return _.flatten([
      writeTerm(expr[0].content),
      writeExpression(expr[2].content),
      writeBinaryOp(expr[1].value)
    ]);
  }

  function writeBinaryExpressionWithFunc(expr): Array<string> {
    return _.flatten([
      writeTerm(expr[0].content),
      writeExpression(expr[2].content),
      writeCall(nonBuiltInOperators[expr[1].value], 2)
    ]);
  }

  function writeUnaryExpression(expr): Array<string> {
    return _.flatten([
      writeTerm(expr[1].content),
      writeUnaryOp(expr[0].value)
    ]);
  }

  function writeExpression(expr): Array<string> {
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

  function writeLetStatement(statementContent): Array<string> {
    const variable = statementContent[1];
    const variableKind = variable.kind;
    const variableIndex = variable.index;

    if (statementContent[2].value === '[') {
      assert(statementContent[1].type === 'Array' && statementContent[4].value === ']');
      const arrayOffsetExpression = statementContent[3].content;
      const rhsExpression = statementContent[6].content;

      return _.flatten([
        // Add offset to array base address
        writePush(variableKind, variableIndex),
        writeExpression(arrayOffsetExpression),
        writeBinaryOp('+'), // now destination address is top of stack

        // save right-hand side value to temp 0
        writeExpression(rhsExpression),
        writePop('temp', 0),

        // pop destination address to that pointer
        writePop('pointer', 1),

        // push right-hand-side value back onto stack and pop into the array index
        writePush('temp', 0),
        writePop('that', 0)
      ]);
    } else {
      const expr = statementContent[3].content;

      return _.flatten([
        writeExpression(expr),
        writePop(variableKind, variableIndex)
      ]);
    }
  }

  function writeIfStatement(statementContent): Array<string> {
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

  function writeWhileStatement(statementContent): Array<string> {
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

  function writeDoStatement(statementContent): Array<string> {
    // do Foo.bar()   Foo is class, bar is function on class, name is Foo.bar
    // do foo.baz()   foo is receiver, baz is method on receiver, name is Foo.baz
    // do baz()       `this` is receiver, baz is method on this, name is Foo.baz

    const hasExplicitReceiver = statementContent[2].value === '.';
    let receiver;
    let name;

    const argsContent = statementContent[statementContent.length - 3].content;
    const args = argsContent.filter(el => el.type === "expression");

    if (hasExplicitReceiver) {
      receiver = statementContent[1];
      name = statementContent[3];
    } else {
      receiver = { type: 'keyword', value: 'this' };
      name = statementContent[1];
    }

    if (receiver.kind === 'class') {
      return _.flatten([
        writeFunctionCall(receiver.value + "." + name.name, args),
        writePop('temp', 0)
      ]);
    } else {
      return _.flatten([
        writeMethodCall(receiver, name.name, args),
        writePop('temp', 0)
      ]);
    }
  }

  function writeReturnStatement(statementContent): Array<string> {
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

  function writeStatement(statement): Array<string> {
    const str = "// " + toString(statement.content);
    return [str].concat(statementTypes[statement.type](statement.content));
  }

  function writeStatements(statements): Array<string> {
    return _.flatMap(statements, writeStatement)
  }

  function writeConstructorInit(): Array<string> {
    const table: { [string]: { kind: string } } = parseTree[0].symbolTable;
    const kinds = Object.keys(table).map(key => table[key].kind);
    const fields = kinds.filter(kind => kind === 'field').length;

    return [
      writePush("constant", fields),
      writeCall("Memory.alloc", 1),
      writePop("pointer", 0)
    ];
  }

  function writeMethodInit(): Array<string> {
    return [
      writePush("argument", 0),
      writePop("pointer", 0)
    ];
  }

  function writeSubroutine(subroutineContent): Array<string> {
    const returnType = subroutineContent[1];
    const name = subroutineContent[2].value;
    const fullName = className + "." + name;
    const bodyContent = subroutineContent[6].content;

    const bodyVarDecs = filterType(bodyContent, 'varDec');
    const localCount = _.sum(bodyVarDecs.map(dec => (dec.content.length - 2) / 2));

    const subroutineType = subroutineContent[0].value;

    const bodyStatements = findType(bodyContent, 'statements').content;

    return _.flatten([
      writeFunction(fullName, localCount),
      (subroutineType === 'constructor') ? writeConstructorInit() : [],
      (subroutineType === 'method') ? writeMethodInit() : [],
      writeStatements(bodyStatements)
    ]);
  }

  function writeClass(classContent): Array<string> {
    const subroutines = filterType(classContent, 'subroutineDec');
    return _.flatMap(subroutines, subroutine => writeSubroutine(subroutine.content));
  }

  return writeClass(parseTree[0].content);
}

module.exports = vmWriter;
