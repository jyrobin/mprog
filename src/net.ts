
import { Meta, Nil, toMeta, Mpi, MetaMap } from './meta';

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
