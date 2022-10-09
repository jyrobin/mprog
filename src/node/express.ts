
import { Domain, toMeta, toMetaMap } from '../index';

export function mountMpi(router: any, prefix: string, dom: Domain) {
    router.post(`${prefix}/call`, async (req: any, res: any) => {
		let body = req.body;

		// TODO: try and 400
		let { method, meta, ctx } = body;
		let ret = await dom.call(method, toMeta(meta), toMetaMap(ctx));
		if (ret.isError()) {
			res.json(400, ret);
		} else {
			res.json(200, ret);
		}
	});
}
