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
      if (kind === 'subroutine') {
        console.log("TRIED TO ADD A SUBROUTINE");
        return;
      }
      const index = indexes[kind]++;
      table[name] = { name, type, kind, index };
    },
    get: (name) => {
      if (table.hasOwnProperty(name)) {
        return table[name];
      } else {
        if (name[0].match(/[A-Z]/)) {
          return { name: name, kind: 'class' };
        } else {
          return { name: name, kind: 'method' };
        }
      }
    }
  };
}

module.exports = symbolTable;
