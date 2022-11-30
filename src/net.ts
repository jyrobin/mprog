import { Meta, toMeta0, Mpi, StrMap } from './meta';
import { Domain, newDomain } from './domain';
import { Actor } from './actor';

export type RemoteMpiConfig = {
    fetch?: any,
    axios?: any,
    headers?: () => StrMap|undefined,
}

export class RemoteMpi implements Mpi {
    protected uri: string;
    protected fetch: any;
    protected headers: () => StrMap|undefined;

    constructor(uri: string, { fetch, headers }: RemoteMpiConfig = {}) {
        this.uri = uri;
        this.fetch = fetch || (window !== undefined && window.fetch);
        this.headers = headers || (() => undefined); 
    }
    call(method: string, meta: Meta, opts: Meta): Promise<Meta> {
        return callMpi(this.fetch, this.uri, method, meta, opts, this.headers());
    }
}

export function callMpi(fetch: any, uri: string, method: string, meta: Meta, opts: Meta, headers?: StrMap) {
    return fetchMpi(fetch, uri, 'POST', method, meta, opts, headers);
}

type MpiHttpMethod = 'POST' | 'PATCH';
async function fetchMpi(fetch: any, uri: string, hm: MpiHttpMethod, method: string, meta: Meta, opts: Meta, headers?: StrMap): Promise<Meta> {
    fetch = fetch || (window !== undefined && window.fetch);

    const httpHeaders = {
       'content-type': 'application/json',
    };
 
    let res = await fetch(uri, {
        method: hm,
        headers: headers ? { ...headers, ...httpHeaders } : httpHeaders,
        body: JSON.stringify({
            method,
            meta,
            options: opts,
        }),
    });
    let ret = await res.json();
    return toMeta0(ret);
}

export function remoteActor(uri: string, method: string, meta: Meta, cfg?: RemoteMpiConfig): Actor {
    const { fetch, headers } = cfg || {};
    return {
        meta,
        process(m: Meta, opts: Meta) {
            return callMpi(fetch, uri, method, m, opts, headers && headers());
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

export function remoteDomain(defaultUri: string, cfg: RemoteDomainConfig, mpiCfg?: RemoteMpiConfig): Domain {
    let uri = cfg.uri || defaultUri;
    return newDomain({
        uri,
        meta: cfg.meta,
        actors: toRemoteActors(uri, cfg.actors || [], mpiCfg),
        ctrls: toRemoteActors(uri, cfg.ctrls || [], mpiCfg),
        subs: toRemoteDomains(uri, cfg.subs || [], mpiCfg), 
    })
}

function toRemoteActors(defaultUri: string, cfgs: RemoteActorConfig[], cfg?: RemoteMpiConfig): Actor[] {
    return cfgs.map(c => remoteActor(c.uri || defaultUri, c.method, c.meta, cfg));
}

function toRemoteDomains(defaultUri: string, cfgs: RemoteDomainConfig[], fetch: any): Domain[] {
    return cfgs.map(c => remoteDomain(defaultUri, c, fetch));
}
