function tokenize(file) {
  let i = 0;

  const SYMBOLS = [
    '(', ')', '{', '}', '[', ']', '.', ',', ';', '+',
    '-', '*', '%', '/', '&', '|', '<', '>', '=', '~'
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

    if (KEYWORDS.includes(ident)) {
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

    return { type: "integerConstant", value: int };
  }

  function tokenizeSymbol() {
    return { type: "symbol", value: consumeChar() };
  }

  function tokenizeString() {
    let str = "";

    advance(); // skip opening quote

    while (getChar() !== '"') {
      str += consumeChar();
    }

    advance(); // skip closing quote

    return { type: "stringConstant", value: str };
  }

  function skipLineComment() {
    while (getChar() !== '\n') {
      advance();
    }
  }

  function skipBlockComment() {
    advance(2);

    while (!(getChar() === '*' && peekChar() === '/')) {
      advance();
    }

    advance(2);
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
    } else if (SYMBOLS.includes(getChar())) {
      tokens.push(tokenizeSymbol());
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
