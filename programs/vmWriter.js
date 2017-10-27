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

  function pp(x) {
    console.log(JSON.stringify(x, null, 2));
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

  function writePush(value) {
    return ["push", value].join(" ");
  }

  function writeOp(op) {
    return op.value;
  }

  // non-terminal write* methods

  function writeTerm(term) {
    pp(term);
    if (term[0].type === 'integerConstant') {
      return writePush(term[0].value);
    } else if (true) { // deal with variables https://www.coursera.org/learn/nand2tetris2/lecture/lEYp6/unit-5-3-handling-expressions 12:10
      return [];
    }
  }

  function writeBinaryExpression(expr) {
    return [
      writeTerm(expr[0].content),
      writeTerm(expr[2].content),
      writeOp(expr[1])
    ];
  }

  function writeUnaryExpression(expr) {
    return [
      writeTerm(expr[1]),
      writeOp(expr[0])
    ];
  }

  function writeExpression(expr) {
    if (expr.length === 1) {
      return writeTerm(expr[0].content);
    } else if (expr[1].type === 'operator') {
      return writeBinaryExpression(expr);
    } else if (expr[0].type === 'operator') {
      return writeUnaryExpression(expr);
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
    const argsContent = statementContent[statementContent.length - 3].content;
    const args = argsContent.filter(el => el.type === "expression");

    return [
      ..._.flatMap(args, arg => writeExpression(arg.content)),
      writeCall(methodName, args.length)
    ];
  }

  function writeReturnStatement(statementContent) {

  }

  function writeStatement(statement) {
    return statementTypes[statement.type](statement.content);
  }

  function writeSubroutine(subroutineContent) {
    const returnType = subroutineContent[1];
    const name = subroutineContent[2].value;
    const parameters = subroutineContent[4]; // probably don't need
    const bodyContent = subroutineContent[6].content[1].content;

    const bodyVarDecs = filterType(bodyContent, 'varDec');
    const bodyStatements = filterType(bodyContent, Object.keys(statementTypes));

    return [
      writeFunction(name, bodyVarDecs.length),
      ..._.flatMap(bodyStatements, writeStatement)
    ];
  }

  function writeClass(classContent) {
    const subroutines = filterType(classContent, 'subroutineDec');
    return _.flatMap(subroutines, subroutine => writeSubroutine(subroutine.content));
  }

  return writeClass(parseTree[0].content);
}

module.exports = vmWriter;
