import { Meta, Nil, toMeta, Mpi, MetaMap } from './meta';
import { Domain, newDomain, newDomainList } from './domain';
import { Actor, newActorList } from './actor';

export class RemoteMpi implements Mpi {
    protected uri: string;
    protected fetch: any;

    constructor(uri: string, fetch: any) {
        this.uri = uri;
        this.fetch = fetch || (window !== undefined && window.fetch);
    }
    call(method: string, meta: Meta, ctx?: MetaMap): Promise<Meta> {
        return callMpi(this.fetch, this.uri, method, meta, ctx);
    }
    ctrl(method: string, meta: Meta = Nil, ctx?: MetaMap): Promise<Meta> {
        // hack for now?
        if (method === 'close' && meta.isNil()) return Promise.resolve(Nil);

        return fetchMpi(this.fetch, this.uri, 'PATCH', method, meta, ctx);
    }
}

export function callMpi(fetch: any, uri: string, method: string, meta: Meta, ctx?: MetaMap) {
    return fetchMpi(fetch, uri, 'POST', method, meta, ctx);
}

type MpiHttpMethod = 'POST' | 'PATCH';
async function fetchMpi(fetch: any, uri: string, hm: MpiHttpMethod, method: string, meta: Meta, ctx?: MetaMap): Promise<Meta> {
    fetch = fetch || (window !== undefined && window.fetch);
    let res = await fetch(uri, {
        method: hm,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            method, meta, ctx,
        }),
    });
    let ret = await res.json();
    return toMeta(ret);
}


export function remoteActor(method: string, meta: Meta, uri: string, fetch: any): Actor {
    return {
        meta,
        process(m: Meta, ctx?: MetaMap) {
            return callMpi(fetch, uri, method, m, ctx);
        },
    };
}

export type RemoteActorConfig = {
    method: string,
    meta: Meta,
    uri?: string,
}

export type RemoteDomainConfig = {
    uri?: string,
    meta: Meta,
    actors?: RemoteActorConfig[]
    ctrls?: RemoteActorConfig[]
    subs?: RemoteDomainConfig[]
}

export function remoteDomain(defaultUri: string, cfg: RemoteDomainConfig, fetch: any): Domain {
    let uri = cfg.uri || defaultUri;
    return newDomain({
        uri,
        meta: cfg.meta,
        actors: newActorList(...toRemoteActors(uri, cfg.actors || [], fetch)),
        ctrls: newActorList(...toRemoteActors(uri, cfg.ctrls || [], fetch)),
        subs: newDomainList(...toRemoteDomains(uri, cfg.subs || [], fetch)), 
    })
}

function toRemoteActors(defaultUri: string, cfgs: RemoteActorConfig[], fetch: any): Actor[] {
    return cfgs.map(c => remoteActor(c.method, c.meta, c.uri || defaultUri, fetch));
}

function toRemoteDomains(defaultUri: string, cfgs: RemoteDomainConfig[], fetch: any): Domain[] {
    return cfgs.map(c => remoteDomain(defaultUri, c, fetch));
}
