
import { Request, Response} from 'express'; 
import { newError, Meta, Mpi, toMeta, NilOptions, toMetaOk } from '../index';

export type OptsModifier = (req: Request, opts: Meta) => Meta; 

export function simpleMpiHandler(mpi: Mpi, optsModifier?: OptsModifier) {
    return async function(req: Request, res: Response) {
        const { method, meta, options } = req.body;
        // console.log(req.url, 'method:', method, JSON.stringify(meta, null, 2));
        // if (options) console.log('options:', JSON.stringify(options, null, 2));

        let err = '';
        if (typeof method !== 'string') {
            err = 'bad method';
        }
        const m = toMeta(meta);
        if (m.isNil() || m.isError()) {
            err = err || 'bad input meta';
        }

        let [opts, ok] = options ? toMetaOk(options) : [NilOptions, true];
        if (!ok) {
            err = 'bad options';
        } 

        if (err) {
            res.status(400).json(newError(err));
            return;
        }

        if (optsModifier) opts = optsModifier(req, opts);

        const ret = await mpi.call(method, m, opts);
        if (ret.isError()) {
            console.log('Error', ret.json('  '));
            res.status(400).json(ret);
            return;
        }

        // console.log('RET', JSON.stringify(ret.object(true), null, 2));
        res.status(200).json(ret);
    }
}
