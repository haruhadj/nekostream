/**
 * Describing a server type as it arrives at the client.
 *
 * A route's return type is not what the client receives: JSON.stringify turns
 * Date into string and drops undefined. Client components used to hand-copy
 * server types with those substitutions already applied, which meant a change
 * on the server silently did not reach the copy. Deriving the shape instead
 * keeps the two tied together.
 */

export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
