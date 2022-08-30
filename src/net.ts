
import { Meta, toMeta, Mpi } from './meta';

export class RemoteMpi implements Mpi {
	uri: string;
	fetch: any;

	constructor(uri: string, fetch: any) {
		this.uri = uri;
		this.fetch = fetch || (window !== undefined && window.fetch);
	}
	async call(method: string, meta: Meta, ...options: Meta[]): Promise<Meta> {
		let ret = await callMpi(this.fetch, this.uri, method, meta, ...options);
		return toMeta(ret); 
	}
}

export async function callMpi(fetch: any, uri: string, method: string, meta: any, ...options: any[]): Promise<any> {
	fetch = fetch || (window !== undefined && window.fetch);
	let res = await fetch(uri, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			method, meta, options,
		}),
	});
	return await res.json();
}
