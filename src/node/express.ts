
import { Request, Response} from 'express'; 
import { Mpi, toMeta, toMetaMap } from '../index';

export function newMpiHandler(mpi: Mpi) {
    return async function(req: Request, res: Response) {
        let body = req.body;

        // TODO: try and 500
        let { method, meta, ctx } = body;
        let ret = await mpi.call(method, toMeta(meta), toMetaMap(ctx));
        if (ret.isError()) {
            res.status(400).json(ret);
        } else {
            res.status(200).json(ret);
        }
    }
}
