
import { Map, List, Record } from 'immutable';
import { Meta, Nil, Mpi, newError } from './meta';
import { Actor, ActorMap, ActorList, ActorListMap } from './actor';

export type DomainList = List<Domain>;

export function newDomainList(...domains: Domain[]): DomainList {
	return List<Domain>(domains);
}

export type DomainType = {
	parent?: Domain
	meta?: Meta
	actors?: ActorList
	subs?: DomainList
}

export interface Domain extends Mpi {
	readonly parent?: Domain
	readonly meta: Meta
	readonly actors: ActorList
	readonly subs: DomainList
	sub(name: string): Domain|undefined
	indexer(): Indexer
}

export interface Indexer {
	gidActors: ActorMap
	kindActorLists: ActorListMap
	methodActors: ActorMap
	actorWithGid(gid: string): Actor|undefined
	actorsWithKind(kind: string): ActorList|undefined
	actorWithMethod(kind: string, method: string): Actor|undefined
}

export class IndexerRecord extends Record({
	gidActors: Map<string, Actor>(),
	kindActorLists: Map<string, ActorList>(),
	methodActors: Map<string, Actor>(),
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
}

export function simpleIndexer(dom: Domain): Indexer {
	let gmap = Map<string, Actor>();
	let kmap = Map<string, ActorList>();
	let mmap = Map<string, Actor>();
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


	return new IndexerRecord({
		gidActors: gmap,
		kindActorLists: kmap,
		methodActors: mmap,
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
	readonly parent: Domain|undefined
	readonly actors: ActorList;
	readonly subs: DomainList;
	private idxer: Indexer|undefined;
	constructor({ parent, meta, actors, subs }: DomainType) {
		this.parent = parent;
		this.meta = meta || Nil;
		this.actors = actors || List<Actor>();
		this.subs = subs || List<Domain>();
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

	async call(method: string, meta: Meta, ...options: Meta[]) {
		let idx = this.indexer();
		let actor = this.indexer().actorWithMethod(meta.kind, method);
		if (actor) {
			let ret = actor.process(meta, ...options);
			return ret === undefined ? Nil : ret;
		}
		return newError(`Actor ${method} for ${meta.kind} not found`)
	}

	list(m: Meta, ...filters: Meta[]) {
		return this.call('list', m, ...filters)
	}
	find(m: Meta, ...filters: Meta[]) {
		return this.call('find', m, ...filters)
	}
	create(m: Meta, ...filters: Meta[]) {
		return this.call('create', m, ...filters)
	}
	make(m: Meta, ...filters: Meta[]) {
		return this.call('make', m, ...filters)
	}

	// reentrant-able as domain itself is constant
	indexer(): Indexer {
		return this.idxer || (this.idxer = simpleIndexer(this));
	}
}
