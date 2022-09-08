
import { Meta, toMeta, Mpi, MetaMap } from './meta';

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
}

export async function callMpi(fetch: any, uri: string, method: string, meta: Meta, ctx?: MetaMap): Promise<Meta> {
	fetch = fetch || (window !== undefined && window.fetch);
	let res = await fetch(uri, {
		method: 'POST',
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
