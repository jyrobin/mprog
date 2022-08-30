import { Map, List } from 'immutable';
import { Nil, Meta, simpleMeta } from './meta';

export interface Actor {
	meta: Meta
	process(m: Meta, ...opts: Meta[]): Meta
}

export type ActorMap = Map<string, Actor>
export type ActorList = List<Actor>
export type ActorListMap = Map<string, ActorList>

export function newActorList(...actors: Actor[]): ActorList {
	return List<Actor>(actors);
}

export type Processor = (self: any, m: Meta, ...opts: Meta[]) => Meta;

export class BaseActor {
	meta: Meta;
	fn: Processor;
	constructor(m: Meta, fn: Processor) {
		this.meta = m;
		this.fn = fn;
	}
	process(m: Meta, ...opts: Meta[]) {
		return this.fn(this, m, ...opts);
	}
}

export function simpleActor(kind: string, method: string, fn: Processor, ...tags: string[]): BaseActor {
	return new BaseActor(simpleMeta('Actor', method, 'target', kind), fn);
}
export function simpleLister(kind: string, fn: Processor, ...tags: string[]): BaseActor {
	return simpleActor(kind, "list", fn, ...tags)
}
export function simpleFinder(kind: string, fn: Processor, ...tags: string[]): BaseActor {
	return simpleActor(kind, "find", fn, ...tags)
}
export function simpleCreator(kind: string, fn: Processor, ...tags: string[]): BaseActor {
	return simpleActor(kind, "create", fn, ...tags)
}
export function simpleMaker(kind: string, fn: Processor, ...tags: string[]): BaseActor {
	return simpleActor(kind, "make", fn, ...tags)
}