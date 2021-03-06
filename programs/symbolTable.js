function symbolTable(name) {
  const table = {};

  const indexes = {
    var: 0,
    argument: 0,
    static: 0,
    field: 0,
    class: 0
  };

  return {
    add: (name, type, kind) => {
      const index = indexes[kind]++;

      if (table.hasOwnProperty(name)) {
        throw new Error(name + " already exists in symbol table");
      }

      table[name] = { name, type, kind, index };
    },
    get: (name) => {
      if (table.hasOwnProperty(name)) {
        return table[name];
      } else {
        return null;
      }
    },
    table: table
  };
}

module.exports = symbolTable;
