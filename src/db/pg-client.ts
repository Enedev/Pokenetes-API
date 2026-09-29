import pg from 'pg';

const TABLES = new Set(['pokemon', 'entrenador', 'batalla']);
const COLUMNS = new Set([
  'id',
  'nombre',
  'tipo',
  'nivel',
  'region',
  'pokemon_id',
  'entrenador_id',
  'resultado',
  'created_at',
]);

type Row = Record<string, unknown>;

function ident(name: string): string {
  if (!COLUMNS.has(name) && !TABLES.has(name)) {
    throw new Error(`invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

class PgQuery {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private values: Row = {};
  private filters: Array<{ column: string; value: unknown }> = [];
  private orderColumn: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private expectOne = false;

  constructor(
    private readonly pool: pg.Pool,
    private readonly table: string,
  ) {
    if (!TABLES.has(table)) {
      throw new Error(`invalid table: ${table}`);
    }
  }

  select(columns = '*'): this {
    this.operation = this.operation === 'select' ? 'select' : this.operation;
    this.columns = columns;
    return this;
  }

  insert(values: Row): this {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values: Row): this {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): Promise<{ data: unknown; error: { message: string } | null }> {
    this.expectOne = true;
    return this.execute();
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    try {
      const table = ident(this.table);
      const where = this.filters
        .map((filter, index) => `${ident(filter.column)} = $${index + 1}`)
        .join(' AND ');
      const filterValues = this.filters.map((filter) => filter.value);

      if (this.operation === 'select') {
        const selectList =
        this.columns === '*'
          ? '*'
          : this.columns.split(',').map((column) => ident(column.trim())).join(', ');
      let sql = `SELECT ${selectList} FROM ${table}`;
        if (where) sql += ` WHERE ${where}`;
        if (this.orderColumn) {
          sql += ` ORDER BY ${ident(this.orderColumn)} ${this.orderAscending ? 'ASC' : 'DESC'}`;
        }
        if (this.limitCount !== null) sql += ` LIMIT ${Number(this.limitCount)}`;
        const result = await this.pool.query(sql, filterValues);
        if (this.expectOne) {
          return {
            data: result.rows[0] ?? null,
            error: result.rows[0] ? null : { message: 'not found' },
          };
        }
        return { data: result.rows, error: null };
      }

      const keys = Object.keys(this.values).filter((key) => COLUMNS.has(key));
      if (this.operation === 'insert') {
        const placeholders = keys.map((_, index) => `$${index + 1}`);
        const sql = `INSERT INTO ${table} (${keys.map(ident).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        const result = await this.pool.query(sql, keys.map((key) => this.values[key]));
        return { data: this.expectOne ? result.rows[0] ?? null : result.rows, error: null };
      }

      if (this.operation === 'update') {
        const assignments = keys.map((key, index) => `${ident(key)} = $${index + 1}`);
        const whereSql = this.filters
          .map((filter, index) => `${ident(filter.column)} = $${keys.length + index + 1}`)
          .join(' AND ');
        const sql = `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${whereSql} RETURNING *`;
        const result = await this.pool.query(sql, [
          ...keys.map((key) => this.values[key]),
          ...filterValues,
        ]);
        return {
          data: result.rows[0] ?? null,
          error: result.rows[0] ? null : { message: 'not found' },
        };
      }

      const sql = `DELETE FROM ${table} WHERE ${where} RETURNING *`;
      const result = await this.pool.query(sql, filterValues);
      return {
        data: result.rows[0] ?? null,
        error: result.rows[0] ? null : { message: 'not found' },
      };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'query failed' },
      };
    }
  }
}

const pools = new Map<string, pg.Pool>();

export function createPgClient(databaseUrl: string): { from: (table: string) => PgQuery } {
  let pool = pools.get(databaseUrl);
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
    });
    pools.set(databaseUrl, pool);
  }

  return {
    from(table: string) {
      return new PgQuery(pool as pg.Pool, table);
    },
  };
}
