/** A plain copy of reactive data. Vue proxies cannot cross the IPC boundary; undefined fields are dropped. */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
