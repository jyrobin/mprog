
import { Request, Response} from 'express'; 
import { Mpi, toMeta, toMetaMap } from '../index';

export function newMpiHandler(mpi: Mpi) {
    return async function(req: Request, res: Response) {
        let body = req.body;

        // TODO: try and 500
        let { method, meta, ctx } = body;
        console.log("BBBBBBBBBBBBBBB", body, mpi);
        let ret = await mpi.call(method, toMeta(meta), toMetaMap(ctx));
        console.log("BBBBBBBBBBBBBBB RET", ret);
        if (ret.isError()) {
            res.status(400).json(ret);
        } else {
            res.status(200).json(ret);
        }
    }
}
