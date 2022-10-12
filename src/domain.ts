
import { Map, List, Record } from 'immutable';
import { Meta, MetaMap, Nil, Mpi, newError } from './meta';
import { Actor, ActorMap, ActorList, ActorListMap } from './actor';

export type DomainList = List<Domain>;

export function newDomainList(...domains: Domain[]): DomainList {
	return List<Domain>(domains);
}

export type DomainType = {
	uri?: string
	parent?: Domain
	meta?: Meta
	actors?: ActorList
	ctrls?: ActorList
	subs?: DomainList
	closer?: () => Promise<void>
}

// although an interface, a domain actually implements things
// - so probably better not to use it to qualify things

export interface Domain extends Mpi {
	readonly parent?: Domain
	readonly uri: string
	readonly meta: Meta
	readonly actors: ActorList
	readonly ctrls: ActorList
	readonly subs: DomainList
	sub(name: string): Domain|undefined
	indexer(): Indexer
}

export interface Indexer {
	gidActors: ActorMap
	kindActorLists: ActorListMap
	methodActors: ActorMap
	ctrlActors: ActorMap
	actorWithGid(gid: string): Actor|undefined
	actorsWithKind(kind: string): ActorList|undefined
	actorWithMethod(kind: string, method: string): Actor|undefined
	actorWithCtrl(method: string, kind?: string): Actor|undefined
}

export class IndexerRecord extends Record({
	gidActors: Map<string, Actor>(),
	kindActorLists: Map<string, ActorList>(),
	methodActors: Map<string, Actor>(),
	ctrlActors: Map<string, Actor>(),
}) implements Indexer {
	actorWithGid(gid: string) {
		return this.gidActors.get(gid);
	}
	actorsWithKind(kind: string) {
		return this.kindActorLists.get(kind);
	}
	actorWithMethod(kind: string, method: string) {
		return this.methodActors.get(kind+'.'+method);
	}
	actorWithCtrl(method: string, kind?: string) {
		return this.ctrlActors.get(kind ? kind+'.'+method : method);
	}
}

export function simpleIndexer(dom: Domain): Indexer {
	let gmap = Map<string, Actor>();
	let kmap = Map<string, ActorList>();
	let mmap = Map<string, Actor>();
	let cmap = Map<string, Actor>();
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
			let lst = kmap.get(kind);
			if (lst) {
				kmap = kmap.set(kind, lst.push(actor));
			} else {
				kmap = kmap.set(kind, List<Actor>([actor]));
			}

			if (am.method) {
				let key = kind + '.' + am.method;
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

	return new IndexerRecord({
		gidActors: gmap,
		kindActorLists: kmap,
		methodActors: mmap,
		ctrlActors: cmap,
	});
}

export class BaseActor {
	private meta: Meta;
	constructor(m: Meta) {
		this.meta = m;
	}
}

export function newDomain(dt: DomainType): Domain {
	return new DomainImpl(dt);
}

export class DomainImpl implements Domain {
	readonly meta: Meta;
	readonly uri: string;
	readonly parent: Domain|undefined
	readonly actors: ActorList;
	readonly subs: DomainList;
	readonly ctrls: ActorList;
	readonly closer?: () => Promise<void>;
	private idxer: Indexer|undefined;
	constructor({ parent, uri, meta, actors, subs, ctrls, closer }: DomainType) {
		this.parent = parent;
		this.uri = uri || '';
		this.meta = meta || Nil;
		this.actors = actors || List<Actor>();
		this.subs = subs || List<Domain>();
		this.ctrls = ctrls || List<Actor>();
		this.closer = closer;
	}

	root(): Domain {
		let root: Domain = this;
		while (root.parent) {
			root = root.parent;
		}
		return root
	}

	sub(name: string) {
		for (let sub of this.subs) {
			if (sub.meta.ns === name) {
				return sub
			}
		}
		return undefined 
	}

	async call(method: string, meta: Meta, ctx?: MetaMap) {
		if (meta.isNil()) {
			return newError(`Calling ${method} with nil meta`);
		}

		let actor = this.indexer().actorWithMethod(meta.kind, method);
		if (!actor) {
			return newError(`${meta.kind}.${method} not found`)
		}

		try {
			let ret = await actor.process(meta, ctx);
			return ret === undefined ? Nil : ret;
		} catch(err) {
			return newError(`ERROR ${meta.kind}.${method}: ${err}`)
		}
	}

	async ctrl(method: string, meta: Meta = Nil, ctx?: MetaMap) {
		// hack for now?
		if (this.closer && method === 'close' && meta.isNil()) {
			await this.closer();
			return Nil;
		}

		let kind = meta.kind;
		let actor = this.indexer().actorWithCtrl(method, kind);
		if (!actor) {
			return newError(`${meta.kind}.${method} not found`)
		}

		try {
			let ret = await actor.process(meta, ctx);
			return ret === undefined ? Nil : ret;
		} catch(err) {
			return newError(`ERROR ${meta.kind}.${method}: ${err}`)
		}
	}

	list(m: Meta, ctx?: MetaMap) {
		return this.call('list', m, ctx)
	}
	find(m: Meta, ctx?: MetaMap) {
		return this.call('find', m, ctx)
	}
	create(m: Meta, ctx?: MetaMap) {
		return this.call('create', m, ctx)
	}
	make(m: Meta, ctx?: MetaMap) {
		return this.call('make', m, ctx)
	}

	// reentrant-able as domain itself is constant
	indexer(): Indexer {
		return this.idxer || (this.idxer = simpleIndexer(this));
	}
}

