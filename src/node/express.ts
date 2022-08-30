
import { Domain, toMeta, toMetaList } from '../index';

export function mountMpi(router: any, prefix: string, dom: Domain) {
    router.post(`${prefix}/call`, async (req: any, res: any) => {
		let body = req.body;
		console.log(body);

		// TODO: try and 400
		let { method, meta, options } = body;
		let ms = options ? toMetaList(options) : []; 
		let ret = await dom.call(method, toMeta(meta), ...ms);
		if (ret.isError()) {
			res.json(400, ret.json())
		} else {
			res.json(200, ret.json());
		}
	})
}