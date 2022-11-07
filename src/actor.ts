import { Map, List } from 'immutable';
import { allPropertyNames } from '@jyrobin/jslib';

import { Meta, MetaMap, simpleMeta } from './meta';

export interface Actor {
    meta: Meta
    process(m: Meta, ctx?: MetaMap): Promise<Meta>
}

export type ActorMap = Map<string, Actor>
export type ActorList = List<Actor>
export type ActorListMap = Map<string, ActorList>

export function newActorList(...actors: Actor[]): ActorList {
    return List<Actor>(actors);
}

export type Processor = (m: Meta, ctx?: MetaMap) => Promise<Meta>;
export type Middleware = (m: Meta, ctx?: MetaMap) => Promise<[Meta, MetaMap?]>;

function preFn(fn: Processor, pre: Middleware): Processor {
    return async (m: Meta, ctx?: MetaMap) => {
        [m, ctx] = await pre(m, ctx);
        return fn(m, ctx);
    };
}

export function simpleActor(kind: string, method: string, fn: Processor, pre?: Middleware, ...tags: string[]): Actor {
    return {
        meta: simpleMeta('Actor', method, 'target', kind, ...tags),
        process: pre? preFn(fn, pre) : fn,
    }
}
export function simpleLister(kind: string, fn: Processor, pre?: Middleware, ...tags: string[]): Actor {
    return simpleActor(kind, "list", fn, pre, ...tags)
}
export function simpleFinder(kind: string, fn: Processor, pre?: Middleware, ...tags: string[]): Actor {
    return simpleActor(kind, "find", fn, pre, ...tags)
}
export function simpleCreator(kind: string, fn: Processor, pre?: Middleware, ...tags: string[]): Actor {
    return simpleActor(kind, "create", fn, pre, ...tags)
}
export function simpleMaker(kind: string, fn: Processor, pre?: Middleware, ...tags: string[]): Actor {
    return simpleActor(kind, "make", fn, pre, ...tags)
}

export function kindActorList(kind: string, actor: any,
    opts?: { prefix?: string, methodNames?: string[], pre?: Middleware }
): Actor[] {
    let { prefix='', methodNames=[], pre } = opts || {};

    if (methodNames.length === 0 && !prefix) {
        prefix = "mpi_";
    }

    let actors: Actor[] = [];

    const props = allPropertyNames(actor);
    if (prefix) {
        props.forEach(name => {
            if (typeof actor[name] === 'function' && name.startsWith(prefix)) {
                let fn = actor[name].bind(actor);
                actors.push(simpleActor(kind, name.slice(prefix.length), fn, pre));
            }
        });
    }

    methodNames.forEach(name => {
        if (typeof actor[name] === 'function') {
            let fn = actor[name].bind(actor);
            actors.push(simpleActor(kind, name, fn, pre));
        }
    });

    return actors;
}

export function extractActorList(actor: any, prefix: string = 'mpi_'): Actor[] {
    const props: string[] = [];
    let obj = actor;
    do {
        props.push(...Object.getOwnPropertyNames(obj));
    } while (obj = Object.getPrototypeOf(obj));

    let actors: Actor[] = [];
    props.forEach(name => {
        if (typeof actor[name] === 'function' && name.startsWith(prefix)) {
            let pair = name.slice(prefix.length).split('_');
            if (pair.length === 2) {
                let fn = actor[name].bind(actor);
                actors.push(simpleActor(pair[0], pair[1], fn));
            }
        }
    });
    return actors;
}
