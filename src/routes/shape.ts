export type Shape = (row: Record<string, unknown>) => Record<string, unknown>;

export function pickColumns(columns: readonly string[]): Shape {
  return (row) => {
    const picked: Record<string, unknown> = {};
    for (const column of columns) {
      if (column in row) picked[column] = row[column];
    }
    return picked;
  };
}

export function applyShape(data: unknown, shape: Shape | undefined): unknown {
  if (!shape || data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map((row) => shape(row as Record<string, unknown>));
  if (typeof data === 'object') return shape(data as Record<string, unknown>);
  return data;
}
