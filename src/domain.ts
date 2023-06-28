
import { Meta, Nil, Mpi, metaError, checkError } from './meta.js';
import { Actor } from './actor.js';

// although an interface, a domain actually implements things
// - so probably better not to use it to qualify things

export interface Domain extends Mpi {
    readonly uri: string
    readonly meta: Meta
    readonly actors: Actor[]
    readonly ctrls: Actor[]
    readonly subs: Domain[]
    sub(name: string): Domain|undefined
    indexer(): Indexer
}

export interface Indexer {
    readonly gidActors: Map<string, Actor>
    readonly kindActorLists: Map<string, Actor[]>
    readonly methodActors: Map<string, Actor>
    readonly ctrlActors: Map<string, Actor>
    actorWithGid(gid: string): Actor|undefined
    actorsWithKind(kind: string): Actor[]
    actorWithMethod(kind: string, method: string, cat?: string): Actor|undefined
    actorWithCtrl(method: string, kind?: string, cat?: string): Actor|undefined
}

export class IndexerImpl implements Indexer {
    readonly gidActors: Map<string, Actor>
    readonly kindActorLists: Map<string, Actor[]>
    readonly methodActors: Map<string, Actor>
    readonly ctrlActors: Map<string, Actor>

    constructor({ gidActors, kindActorLists, methodActors, ctrlActors }: {
        gidActors: Map<string, Actor>,
        kindActorLists: Map<string, Actor[]>,
        methodActors: Map<string, Actor>,
        ctrlActors: Map<string, Actor>,
    }) {
        this.gidActors = gidActors;
        this.kindActorLists = kindActorLists;
        this.methodActors = methodActors;
        this.ctrlActors = ctrlActors;
    }

    actorWithGid(gid: string) {
        return this.gidActors.get(gid);
    }
    actorsWithKind(kind: string) {
        return this.kindActorLists.get(kind) || [];
    }
    actorWithMethod(kind: string, method: string, cat?: string) {
        kind = cat ? kind + '[' + cat + ']' : kind;
        return this.methodActors.get(kind+'.'+method);
    }
    actorWithCtrl(method: string, kind?: string, cat?: string) { // no kind no cat
        kind = kind && cat ? kind + '[' + cat + ']' : kind; 
        return this.ctrlActors.get(kind ? kind+'.'+method : method);
    }
}

export function simpleIndexer(dom: Domain): Indexer {
    let gmap = new Map<string, Actor>();
    let kmap = new Map<string, Actor[]>();
    let mmap = new Map<string, Actor>();
    let cmap = new Map<string, Actor>();
    for (let actor of dom.actors) {
        let am = actor.meta;
        let gid = am.gid;
        if (gid && !gmap.has(gid)) { // no override...
            gmap = gmap.set(gid, actor);
        }

        let kind = am.tag('target') // override target rel for now
        if (!kind) {
            let tm = am.rel('target');
            if (tm.kind) {
                kind = tm.kind
                if (tm.ns) {
                    kind = tm.ns + ':' + kind;
                }
            }
        }

        if (kind) {
            // TODO: a hack, special 'cat' tag to further classify kind for now
            let cat = am.tag('cat') || am.rel('target').tag('cat');
            if (cat) {
                kind = kind + '[' + cat.trim() + ']';
            }

            let lst = kmap.get(kind);
            if (lst) {
                lst.push(actor);
                //kmap = kmap.set(kind, lst.push(actor));
            } else {
                kmap = kmap.set(kind, [actor]);
            }

            if (am.method) {
                let key = kind + '.' + am.method.trim();
                if (!mmap.has(key)) {
                    mmap = mmap.set(key, actor);
                }
            }
        }
    }

    for (let sub of dom.subs) {
        let { gidActors: gm, kindActorLists: km, methodActors: mm } = sub.indexer();
        for (let [k, v] of gm) {
            if (!gmap.has(k)) {
                gmap = gmap.set(k, v);
            }
        }
        for (let [k, v] of km) {
            let old = kmap.get(k);
            kmap = kmap.set(k, old ? old.concat(v) : v);
        }
        for (let [k, v] of mm) {
            if (!mmap.has(k)) {
                mmap = mmap.set(k, v);
            }
        }
    }

    for (let actor of dom.ctrls) {
        let am = actor.meta;
        if (am.method) {
            let kind = am.tag('target') // override target rel
            if (!kind) {
                let tm = am.rel('target');
                if (tm.kind) {
                    kind = tm.kind
                    if (tm.ns) {
                        kind = tm.ns + ':' + kind;
                    }
                }
            }

            let key = kind ? kind + '.' + am.method : am.method;
            if (!cmap.has(key)) {
                cmap = cmap.set(key, actor);
            }
        }
    }

    return new IndexerImpl({
        gidActors: gmap,
        kindActorLists: kmap,
        methodActors: mmap,
        ctrlActors: cmap,
    });
}

export class BaseActor {
    protected meta: Meta;
    constructor(m: Meta) {
        this.meta = m;
    }
}

export type DomainConfig = {
    uri?: string
    meta?: Meta
    actors?: Actor[]
    ctrls?: Actor[]
    subs?: Domain[]
    closer?: () => Promise<void>
}

export function newDomain(dt: DomainConfig): Domain {
    return new DomainImpl(dt);
}

export class DomainImpl implements Domain {
    readonly meta: Meta;
    readonly uri: string;
    readonly actors: Actor[];
    readonly subs: Domain[];
    readonly ctrls: Actor[];
    readonly closer?: () => Promise<void>;
    private idxer: Indexer|undefined;
    constructor({ uri, meta, actors, subs, ctrls, closer }: DomainConfig) {
        this.uri = uri || '';
        this.meta = meta || Nil;
        this.actors = actors || [];
        this.subs = subs || [];
        this.ctrls = ctrls || [];
        this.closer = closer;
    }

    sub(name: string) {
        for (let sub of this.subs) {
            if (sub.meta.ns === name) {
                return sub
            }
        }
        return undefined 
    }

    async call(method: string, meta: Meta, opts?: Meta) {
        if (meta.isNil()) {
            return metaError(`Calling ${method} with nil meta`, 400);
        }

        let cat = meta.tag('cat');
        let actor = this.indexer().actorWithMethod(meta.kind, method, cat);
        if (!actor) {
            return metaError(`${meta.kind}.${method} not found`, 404)
        }

        try {
            let ret = await actor.process(meta, opts || Nil);
            return ret === undefined ? Nil : ret;
        } catch(err) {
            if (checkError(err)) {
                return metaError(`[${meta.kind}.${method}] ${err.message}`, err.code);
            } else {
                return metaError(`[${meta.kind}.${method}] ${err}`, 400);
            }

        }
    }

    indexer(): Indexer {
        return this.idxer || (this.idxer = simpleIndexer(this));
    }
}
