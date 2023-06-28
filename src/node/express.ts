
import { Request, Response} from 'express'; 
import { metaError, Meta, Nil, Mpi, toMeta, toMetaOk } from '../index.js';

import deb from 'debug';
const debug = deb('mprog:express');

export type OptsModifier = (req: Request, opts: Meta) => Meta; 

export function simpleMpiHandler(mpi: Mpi, optsModifier?: OptsModifier) {
    return async function(req: Request, res: Response) {
        const { method, meta, options } = req.body;
        debug('%s method: %s meta: %O opts: %O', req.url, method, meta, options);
        //debug('   authorization: %s', req.header('authorization'));

        let err = '';
        if (typeof method !== 'string') {
            err = 'bad method';
        }
        const m = toMeta(meta);
        if (m.isNil() || m.isError()) {
            err = err || 'bad input meta';
        }

        let [opts, ok] = options ? toMetaOk(options) : [Nil, true];
        if (!ok) {
            err = 'bad options';
        } 

        if (err) {
            res.status(400).json(metaError(err, 400));
            return;
        }

        if (optsModifier) opts = optsModifier(req, opts);

        const ret = await mpi.call(method, m, opts);
        if (ret.isError()) {
            debug('Error: %O', ret.object());
            res.status(ret.httpErrorCode() || 400).json(ret);
            return;
        }

        debug('Returning %O', ret.object(true));
        res.status(200).json(ret);
    }
}
