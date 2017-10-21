function tokenize(file) {
  let i = 0;

  const OPERATORS = [
    '(', ')', '{', '}', '[', ']', '.', ',', ';', '+',
    '-', '*', '/', '&', '|', '<', '>', '=', '~'
  ];

  const KEYWORDS = [
    'class', 'constructor', 'function', 'method', 'field', 'static',
    'var', 'int', 'char', 'boolean', 'void', 'true', 'false',
    'null', 'this', 'let', 'do', 'if', 'else', 'while', 'return'
  ];

  const tokens = [];

  function moreChars() {
    return i < file.length;
  }

  function getChar() {
    return file[i];
  }

  function peekChar() {
    return file[i + 1];
  }

  function consumeChar() {
    return file[i++];
  }

  function advance(n = 1) {
    i += n;
  }

  function skipWhitespace() {
    while (moreChars() && getChar().match(/\s/)) {
      advance();
    }
  }

  function tokenizeIdentifierOrKeyword() {
    let ident = "";

    while (getChar().match(/[a-zA-Z0-9_]/)) {
      ident += consumeChar();
    }

    if (KEYWORDS.indexOf(ident) !== -1) {
      return { type: "keyword", value: ident };
    } else {
      return { type: "identifier", value: ident };
    }
  }

  function tokenizeInteger() {
    let int = "";

    while (getChar().match(/[0-9]/)) {
      int += consumeChar();
    }

    return { type: "integer", value: int };
  }

  function tokenizeOperator() {
    return { type: "operator", value: consumeChar() };
  }

  function tokenizeString() {
    let str = "";

    while (getChar() !== '"') {
      str += consumeChar();
    }

    return { type: "string", value: str };
  }

  function skipLineComment() {
    while (getChar() !== '\n') {
      advance();
    }
  }

  function skipBlockComment() {
    while (getChar() !== '*' && peekChar() !== '/') {
      advance();
    }
  }


  while (moreChars()) {
    skipWhitespace();

    if (!moreChars()) {
      break;
    }

    if (getChar().match(/[a-zA-Z_]/)) {
      tokens.push(tokenizeIdentifierOrKeyword());
    } else if (getChar().match(/[0-9]/)) {
      tokens.push(tokenizeInteger());
    } else if (getChar() === '/' && peekChar() === '/') {
      skipLineComment();
    } else if (getChar() === '/' && peekChar() === '*') {
      skipBlockComment();
    } else if (OPERATORS.indexOf(getChar()) !== -1) {
      tokens.push(tokenizeOperator());
    } else if (getChar() === '"') {
      tokens.push(tokenizeString());
    } else {
      console.log(i, tokens, getChar());
      throw new Error(getChar());
    }
  }

  return tokens;
}

module.exports = tokenize;
