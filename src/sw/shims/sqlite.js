// node:sqlite → sql.js (SQLite в WebAssembly). Состояние живёт в globalThis.__palada, его готовит worker.js.
const state = () => globalThis.__palada;
const READ = /^\s*(select|with|pragma\s+table_info)\b/i;
const clean = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'bigint' ? Number(v) : v);

class StatementSync {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.write = !READ.test(sql);
  }
  _stmt(params) {
    const st = this.db.prepare(this.sql);
    if (params.length) st.bind(params.map(clean));
    return st;
  }
  all(...params) {
    const st = this._stmt(params);
    const rows = [];
    try {
      while (st.step()) rows.push(st.getAsObject());
    } finally {
      st.free();
    }
    if (this.write) state().dirty = true;
    return rows;
  }
  get(...params) {
    const st = this._stmt(params);
    let row;
    try {
      row = st.step() ? st.getAsObject() : undefined;
    } finally {
      st.free();
    }
    if (this.write) state().dirty = true;
    return row;
  }
  run(...params) {
    const st = this._stmt(params);
    try {
      st.step();
    } finally {
      st.free();
    }
    const changes = this.db.getRowsModified();
    const r = this.db.exec('select last_insert_rowid()');
    state().dirty = true;
    return { changes, lastInsertRowid: r[0] ? r[0].values[0][0] : 0 };
  }
}

export class DatabaseSync {
  constructor() {
    const s = state();
    if (!s.db) s.db = s.bytes ? new s.SQL.Database(s.bytes) : new s.SQL.Database();
    this.db = s.db;
  }
  exec(sql) {
    this.db.exec(sql);
    if (!READ.test(sql)) state().dirty = true;
  }
  prepare(sql) {
    return new StatementSync(this.db, sql);
  }
  close() {}
}

export default { DatabaseSync };
