/**
 * A stand-in for the Drizzle client.
 *
 * Every Drizzle query is a chain of builder calls that is finally awaited
 * (`db.select().from(t).where(c).limit(1)`), so one chainable thenable covers
 * select, insert, update and delete alike. Results are queued in the order the
 * route awaits them.
 */

export type DbStub = {
  /** Results handed to each successive awaited query, in order. */
  queue: unknown[];
  db: unknown;
  /** How many queries were awaited. */
  count(): number;
};

export function stubDb(results: unknown[] = []): DbStub {
  const queue = [...results];
  let awaited = 0;

  const chain: unknown = new Proxy(function () {} as object, {
    get(_target, property) {
      if (property === "then") {
        return (onFulfilled: (value: unknown) => unknown) => {
          const value = awaited < queue.length ? queue[awaited] : [];
          awaited++;
          return Promise.resolve(value).then(onFulfilled);
        };
      }
      return () => chain;
    },
    apply: () => chain,
  });

  return {
    queue,
    db: chain,
    count: () => awaited,
  };
}
