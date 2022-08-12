import { Map, List } from 'immutable';
import { Meta, simpleMeta } from './meta';

export interface Actor {
	meta: Meta
	process(m: Meta, ...opts: Meta[]): Meta
}

export type ActorMap = Map<string, Actor>
export type ActorList = List<Actor>
export type ActorListMap = Map<string, ActorList>

export class BaseActor {
	private meta: Meta;
	constructor(m: Meta) {
		this.meta = m;
	}
}

export function simpleActor(kind: string, method: string, ...tags: string[]): BaseActor {
	return new BaseActor(simpleMeta(kind, method, ...tags));
}
export function simpleLister(kind: string, ...tags: string[]): BaseActor {
	return simpleActor(kind, "list", ...tags)
}
export function simpleFinder(kind: string, ...tags: string[]): BaseActor {
	return simpleActor(kind, "find", ...tags)
}
export function simpleCreator(kind: string, ...tags: string[]): BaseActor {
	return simpleActor(kind, "creator", ...tags)
}
export function simpleMaker(kind: string, ...tags: string[]): BaseActor {
	return simpleActor(kind, "maker", ...tags)
}