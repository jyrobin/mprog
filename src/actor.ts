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

export function kindActorList(kind: string, actor: any, prefix: string = 'mpi_', ...extraNames: string[]): Actor[] {
  const props: string[] = [];
  let obj = actor;
  do {
      props.push(...Object.getOwnPropertyNames(obj));
  } while (obj = Object.getPrototypeOf(obj));

  let actors: Actor[] = [];
  props.forEach(name => {
    if (typeof actor[name] === 'function' && name.startsWith(prefix)) {
      let fn = actor[name].bind(actor);
      actors.push(simpleActor(kind, name.slice(prefix.length), fn));
    }
  });

  extraNames.forEach(name => {
    if (typeof actor[name] === 'function') {
      let fn = actor[name].bind(actor);
      actors.push(simpleActor(kind, name, fn));
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
