import { allPropertyNames } from '@jyrobin/jslib';

import { Meta, simpleMeta } from './meta';

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

export function kindActorList(kind: string, actor: any,
    opts?: { cat?: string, prefix?: string, methodNames?: string[] }
): Actor[] {
    let { prefix, methodNames=[], cat } = opts || {};

    if (methodNames.length === 0 && prefix === undefined) {
        prefix = "mpi_";
    }

    let tags = cat ? ['cat', cat.trim()] : [];

    let actors: Actor[] = [];

    const props = allPropertyNames(actor);
    if (typeof prefix === 'string') {
        const pf = prefix;
        props.forEach(name => {
            if (typeof actor[name] === 'function' && name.startsWith(pf)) {
                let fn = actor[name].bind(actor);
                actors.push(simpleActor(kind, name.slice(pf.length), fn, ...tags));
            }
        });
    }

    methodNames.forEach(name => {
        if (typeof actor[name] === 'function') {
            let fn = actor[name].bind(actor);
            actors.push(simpleActor(kind, name, fn, ...tags));
        }
    });

    return actors;
}
