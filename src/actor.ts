import { Map, List } from 'immutable';
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

export function simpleActor(kind: string, method: string, fn: Processor, ...tags: string[]): Actor {
	return {
		meta: simpleMeta('Actor', method, 'target', kind, ...tags),
		process: fn,
	}
}
export function simpleLister(kind: string, fn: Processor, ...tags: string[]): Actor {
	return simpleActor(kind, "list", fn, ...tags)
}
export function simpleFinder(kind: string, fn: Processor, ...tags: string[]): Actor {
	return simpleActor(kind, "find", fn, ...tags)
}
export function simpleCreator(kind: string, fn: Processor, ...tags: string[]): Actor {
	return simpleActor(kind, "create", fn, ...tags)
}
export function simpleMaker(kind: string, fn: Processor, ...tags: string[]): Actor {
	return simpleActor(kind, "make", fn, ...tags)
}