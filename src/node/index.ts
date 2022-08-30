
import { Meta, Mpi, parseMeta } from '../index';

export class RemoteMpi implements Mpi {
	uri: string;

	constructor(uri: string) {
		this.uri = uri;
	}

	async call(method: string, meta: Meta, ...options: Meta[]): Promise<Meta> {
		var cfg = { method: 'POST' };
		//if (opts) Object.assign(cfg, opts); // including headers
		//if (body != null) opts.body = JSON.stringify(body);
		//cfg.headers = Object.assign({}, cfg.headers || {}, this._ajaxHeaders);

		let res = await fetch(this.uri, cfg);
		let ret = await res.json();
		return parseMeta(ret); 
	}
}
