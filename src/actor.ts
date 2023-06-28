import { allPropertyNames } from './utils.js';

import { Meta, simpleMeta } from './meta.js';

export interface Actor {
    meta: Meta
    process(m: Meta, opts: Meta): Promise<Meta>; // make opts non-optional here
}

export type Processor = (m: Meta, opts: Meta) => Promise<Meta>;

export function simpleActor(kind: string, method: string, fn: Processor, ...tags: string[]): Actor {
    return {
        meta: simpleMeta('Actor', method, 'target', kind, ...tags),
        process: fn,
    }
}
