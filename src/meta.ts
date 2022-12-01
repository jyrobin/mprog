
export const ErrorKind = 'Error';

export const TRUTH: Readonly<{ [key: string]: boolean }> = {
    '1': true, 'true': true, 'yes': true, 'on': true,
    '0': false, 'false': false, 'no': false, 'off': false,
}

export type Json = string | number | boolean | null |
    Json[] | { [key: string]: Json };
export type JsonMap = { [key: string]: Json };

export type StrMap = { [key: string]: string }
export type MetaMap = { [key: string]: Meta }
export type RoStrMap = Readonly<StrMap>
export type RoMetaMap = Readonly<MetaMap>
export type MetaList = Readonly<Meta[]>
export type Headers = () => StrMap|undefined
type AnyMap = { [key: string]: any }

export interface Mpi {
    call(method: string, meta: Meta, opts: Meta): Promise<Meta>
}

export const NilMpi = {
    async call(method: string, meta: Meta, opts: Meta) {
        return Nil;
    },
}

export type MetaConfig = {
    kind: string
    method?: string
    ns?: string
    gid?: string
    payload?: string
    tags?: StrMap
    attrs?: StrMap
    subs?: MetaMap
    rels?: MetaMap
    list?: MetaList
}

type StringValue = string|number|boolean|null|undefined;

function isValue(v: unknown): boolean {
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

export interface Meta {
    readonly kind: string
    readonly method?: string
    readonly ns?: string
    readonly gid?: string
    readonly payload?: string
    readonly tags: RoStrMap
    readonly attrs: RoStrMap
    readonly subs: RoMetaMap
    readonly rels: RoMetaMap
    readonly list: MetaList

    isNil(): boolean

    tag(name: string): string | undefined
    hasTag(...args: string[]): boolean
    hasTags(tags: StrMap): boolean
    is(kind: string, ns: string, ...tags: string[]): boolean

    attr(name: string, otherwise?: string): string
    attrOk(name: string): [string, boolean]
    hasAttr(...args: StringValue[]): boolean
    hasAttrs(attrs: StrMap): boolean
    numAttr(name: string, otherwise?: number): number
    numAttrOk(name: string): [number, boolean]
    intAttr(name: string, otherwise?: number): number
    intAttrOk(name: string): [number, boolean]
    boolAttr(name: string, otherwise?: boolean): boolean
    boolAttrOk(name: string): [boolean, boolean]
    dateAttr(name: string, otherwise?: Date): Date
    dateAttrOk(name: string): [Date, boolean]

    isError(): boolean
    parseError(defaultCode: number): [string, number]
    isValid(): boolean

    withKind(kind: string): Meta
    withMethod(mthd: string): Meta
    withGid(gid: string): Meta
    withPayload(data: string): Meta

    setTag(name: string, value: string, ...rest: string[]): Meta
    withTag(name: string, value: string, ...rest: string[]): Meta
    delTag(...names: string[]): Meta
    setTags(tags: StrMap): Meta
    withTags(tags: StrMap): Meta
    setAttr(...args: StringValue[]): Meta
    delAttr(...names: string[]): Meta
    withAttr(...args: StringValue[]): Meta
    setAttrs(attrs: StrMap): Meta
    withAttrs(attrs: StrMap): Meta

    withSub(name: string, sub: Meta): Meta
    delSub(...names: string[]): Meta
    withSubs(subs: MetaMap): Meta
    hasSub(name: string): boolean
    sub(name: string): Meta

    withRel(name: string, rel: Meta): Meta
    delRel(...names: string[]): Meta
    withRels(rels: MetaMap): Meta
    hasRel(name: string): boolean
    rel(name: string): Meta

    setList(list: Meta[], trims?: boolean): Meta

    generalizes(m: Meta): boolean
    specializes(m: Meta): boolean

    walk(v: Visitor): void

    json(...opts: string[]): string
    object(expandPayload?: boolean): AnyMap
    toJSON(): AnyMap
}

export function simpleMeta(kind: string, method?: string, ...tags: string[]) {
    return new SimpleMeta({
        kind, method, tags: arrayToStrMap(tags),
    });
}
export function newMeta(mt: MetaConfig, ...attrs: StringValue[]): Meta {
    const ret = new SimpleMeta(mt);
    return attrs.length > 0 ? ret.withAttr(...attrs) : ret;
}

export function parseMeta(str: string): [Meta, boolean] {
    const obj = JSON.parse(str);
    return toMetaOk(obj);
}

export function toMeta(obj: unknown): Meta {
    return toMetaOk(obj)[0]; // just Nil for false case
}

export function toMetaOk(obj: unknown): [Meta, boolean] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [Nil, false] 

    // avoid using external library
    const { kind, method, ns, gid, payload, tags, attrs, subs, rels, list } = toPlainObject(obj);
    let b = typeof kind === 'string';
    b = b && (method === undefined || typeof method === 'string');
    b = b && (ns === undefined || typeof ns === 'string');
    b = b && (gid === undefined || typeof gid === 'string');
    b = b && (payload === undefined || typeof payload === 'string');
    if (!b) return [Nil, false];

    // but then something inside may be skipped
    return [new SimpleMeta({
        kind, method, ns, gid, payload,
        tags: tags ? toStrMap(tags) : undefined,
        attrs: attrs ? toAttrMap(attrs) : undefined,
        subs: subs ? toMetaMap(subs) : undefined,
        rels: rels ? toMetaMap(rels) : undefined,
        list: list ? toMetaList(list) : undefined,
    }), true];
}

export function toMetaMap(obj: unknown): RoMetaMap | undefined {
    if (obj && typeof obj === 'object') {
        const ret: MetaMap = {};
        for (let [k, v] of Object.entries(obj)) {
            const [m, ok] = toMetaOk(v);
            if (ok) ret[k] = m;
        }
        return ret;
    }
    return;
}

export function toMetaList(obj: unknown): MetaList {
    return Array.isArray(obj) ? obj.map(toMeta) : [];
}

export class SimpleMeta implements Meta {
    readonly kind: string
    readonly method?: string
    readonly ns?: string
    readonly gid?: string
    readonly payload?: string
    readonly tags: RoStrMap
    readonly attrs: RoStrMap
    readonly subs: RoMetaMap
    readonly rels: RoMetaMap
    readonly list: MetaList
    constructor(mt: MetaConfig) {
        const { kind, method, ns, gid, payload, tags, attrs, subs, rels, list } = mt;
        this.kind = kind;
        method && (this.method = method);
        ns && (this.ns = ns);
        gid && (this.gid = gid);
        payload && (this.payload = payload);
        this.tags = tags || {};
        this.attrs = attrs || {};
        this.subs = subs || {};
        this.rels = rels || {};
        this.list = list || [];
    }

    isNil() {
        return this.kind === '';
    }
    tag(name: string) {
        return this.tags[name];
    }
    hasTag(...args: string[]) {
        return hasValue(this.tags, args);
    }
    hasTags(ts: StrMap) {
        return hasValues(this.tags, ts)
    }
    is(kind: string, ns?: string, ...tags: string[]) {
        return this.kind === kind && this.ns === (ns || '') && this.hasTag(...tags);
    }

    attr(name: string, otherwise?: string): string {
        const ret = this.attrs[name];
        return typeof ret === 'string' ? ret : (otherwise || '');
    }

    attrOk(name: string): [string, boolean] {
        const ret = this.attrs[name];
        return typeof ret === 'string' ? [ret, true] : ['', false];
    }

    hasAttr(...args: StringValue[]) {
        return hasValue(this.attrs, args);
    }
    hasAttrs(ts: StrMap) {
        return hasValues(this.attrs, ts)
    }

    numAttr(name: string, otherwise?: number): number {
        const ret = Number(this.attrs[name]);
        return !isNaN(ret) ? ret : (otherwise === undefined ? NaN : otherwise);
    }
    numAttrOk(name: string): [number, boolean] {
        const ret = Number(this.attrs[name]);
        return [ret, isNaN(ret)]
    }
 
    intAttr(name: string, otherwise?: number): number {
        const ret = Number(this.attrs[name]);
        if (!isNaN(ret) && ret === Math.floor(ret)) return ret;
        return otherwise === undefined ? NaN : Math.floor(otherwise);
    }
    intAttrOk(name: string): [number, boolean] {
        const ret = Number(this.attrs[name]);
        if (!isNaN(ret) && ret === Math.floor(ret)) return [ret, true];
        return [ret, false];
    }

    boolAttr(name: string, otherwise: boolean = false): boolean {
        const attr = this.attrs[name];
        if (attr === undefined) return otherwise;

        const ret = TRUTH[attr.toLowerCase()];
        return ret === undefined ? otherwise : ret;
    }
    boolAttrOk(name: string): [boolean, boolean] {
        const attr = this.attrs[name];
        if (attr === undefined) return [false, false];

        const ret = TRUTH[attr.toLowerCase()];
        return ret === undefined ? [false, false] : [ret, true];
    }

    dateAttr(name: string, otherwise?: Date): Date {
        const d = new Date(this.attr(name));
        return !isNaN(d.valueOf()) ? d : (otherwise === undefined ? d : otherwise); 
    }
    dateAttrOk(name: string): [Date, boolean] {
        const d = new Date(this.attr(name));
        return [d, !isNaN(d.valueOf())]
    }

    // meta

    isError() {
        return this.kind === ErrorKind;
    }
    parseError(defaultCode: number): [string, number] {
        const msg = this.attr('message');
        let code = Number(this.attr('code'));
        if (isNaN(code)) code = defaultCode;
        return [msg?.toString() || '', code];
    }

    isValid() {
        return !this.isNil() && !this.isError();
    }

    withKind(kind: string): Meta {
        return new SimpleMeta({ ...this, kind });
    }

    withMethod(method: string): Meta {
        return new SimpleMeta({ ...this, method });
    }

    withGid(gid: string) {
        return new SimpleMeta({ ...this, gid });
    }

    withPayload(payload: string) {
        return new SimpleMeta({ ...this, payload });
    }

    setTag(...args: string[]) {
        const tags = arrayToStrMap(args);
        return new SimpleMeta({ ...this, tags });
    }
    withTag(...args: string[]) {
        if (args.length === 0) return this;

        const tags = { ...this.tags, ...arrayToStrMap(args) };
        return new SimpleMeta({ ...this, tags });
    }
    delTag(...names: string[]) {
        if (names.length === 0) return this; 

        const tags = { ...this.tags }
        names.forEach(name => delete tags[name]);
        return new SimpleMeta({ ...this, tags });
    }

    setTags(tags: StrMap) {
        return new SimpleMeta({ ...this, tags });
    }
    withTags(tagMap: StrMap) {
        if (isEmpty(tagMap)) return this;

        const tags = { ...this.tags, ...tagMap };
        return new SimpleMeta({ ...this, tags });
    }

    setAttr(...args: StringValue[]) {
        const attrs = arrayToStrMap(args);
        return new SimpleMeta({ ...this, attrs });
    }
    delAttr(...names: string[]) {
        if (names.length === 0) return this; 

        const attrs = { ...this.attrs }
        names.forEach(name => delete attrs[name]);
        return new SimpleMeta({ ...this, attrs });
    }

    withAttr(...args: StringValue[]) {
        if (args.length === 0) return this;

        const attrs = { ...this.attrs, ...arrayToStrMap(args) };
        return new SimpleMeta({ ...this, attrs });
    }
    setAttrs(attrs: StrMap) {
        return new SimpleMeta({ ...this, attrs });
    }
    withAttrs(attrMap: StrMap) {
        if (isEmpty(attrMap)) return this;

        const attrs = { ...this.attrs, ...attrMap };
        return new SimpleMeta({ ...this, attrs });
    }

    sub(name: string): Meta {
        return this.subs[name] || Nil;
    }
    hasSub(name: string) {
        return !!this.subs[name];
    }
    withSub(name: string, sub: Meta) {
        const subs = { ...this.subs, [name]: sub };
        return new SimpleMeta({ ...this, subs });
    }
    delSub(...names: string[]) {
        if (names.length === 0) return this; 

        const subs = { ...this.subs }
        names.forEach(name => delete subs[name]);
        return new SimpleMeta({ ...this, subs });
    }

    withSubs(subMap: MetaMap) {
        const subs = { ...this.subs, ...subMap };
        return new SimpleMeta({ ...this, subs });
    }

    rel(name: string): Meta {
        return this.rels[name] || Nil;
    }
    hasRel(name: string) {
        return !!this.rels[name];
    }
    withRel(name: string, rel: Meta) {
        const rels = { ...this.rels, [name]: rel };
        return new SimpleMeta({ ...this, rels });
    }
    delRel(...names: string[]) {
        if (names.length === 0) return this; 

        const rels = { ...this.rels }
        names.forEach(name => delete rels[name]);
        return new SimpleMeta({ ...this, rels });
    }

    withRels(relMap: MetaMap) {
        const rels = { ...this.rels, ...relMap };
        return new SimpleMeta({ ...this, rels });
    }

    setList(list: Meta[], trims?: boolean) {
        list = !trims ? list : list.filter(m => !m.isNil());
        return new SimpleMeta({ ...this, list });
    }

    listItem(idx: number) {
        return this.list[idx];
    }

    generalizes(n: Meta): boolean {
        if (this.kind === n.kind) {
            for (let [k, v] of Object.entries(this.tags)) {
                if (!n.hasTag(k, v)) {
                    return false
                }
            }
        }
        return true
    }

    specializes(n: Meta): boolean {
        return n.generalizes(this);
    }

    json(...opts: string[]): string {
        return JSON.stringify(this.object(), null, opts[0]);
    }

    object(expandPayload?: boolean): AnyMap {
        return toJson(this, expandPayload);
    }

    toJSON() {
        return this.object(false)
    }

    // traverse

    walk(v: Visitor) {
        walk(this, v);
    }
}

export function toPlainObject(obj: unknown): {[key: string]: any} {
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
        return obj as {[key: string]: any};
    }
    return {};
}

export function toStrMap(obj: unknown): RoStrMap {
    const ret: StrMap = {};
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (let [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') {
                ret[k] = v;
            }
        }
    }
    return ret;
}

export function toAttrMap(obj: unknown): RoStrMap {
    const ret: StrMap = {};
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (let [k, v] of Object.entries(obj)) {
            if (isValue(v)) {
                ret[k] = v.toString();
            }
        }
    }
    return ret;
}

export function arrayToStrMap(args: StringValue[]): StrMap {
    const ret: StrMap = {};
    for (let i = 1, n = args.length; i < n; i += 2) {
        const k = args[i - 1];
        const v = args[i];
        if (typeof k === 'string') {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                ret[k] = v.toString();
            }
        }
    }
    return ret;
}

function hasValue(vals: RoStrMap, args: StringValue[]): boolean {
    const argn = args.length;
    for (let i = 0, n = argn / 2; i < n; i++) {
        const key = args[2 * i];
        if (typeof key !== 'string') return false;

        const val = vals[key];
        const arg = args[2 * i + 1];
        if (val === undefined) {
            if (arg != null) return false;
        } else if (isValue(val)) {
            if (arg == null || arg.toString() !== val) return false;
        } else {
            return false;
        }
    }
    if (argn % 2 !== 0) {
        const key = args[argn - 1];
        if (typeof key !== 'string' || vals[key] === undefined) return false;
    }

    return true
}

function hasValues(vals: RoStrMap, ts: StrMap): boolean {
    for (let [key, value] of Object.entries(ts)) {
        if (vals[key] !== value) {
            return false;
        }
    }
    return true;
}

export const Nil: Meta = new SimpleMeta({ kind: '' });
export const NilOptions: Meta = new SimpleMeta({ kind: 'Options' });

export interface Visitor {
    beginMeta(m: Meta, kind: string, method?: string, ns?: string, gid?: string): void;
    onTag(m: Meta, name: string, value: string): void
    onAttr(m: Meta, name: string, value: string): void
    onSub(m: Meta, name: string, sub: Meta): void
    onRel(m: Meta, name: string, rel: Meta): void
    onListItem(m: Meta, index: number, item: Meta): void
    endMeta(m: Meta): void
}

function walk(m: Meta, v: Visitor) {
    v.beginMeta(m, m.kind, m.method, m.ns, m.gid)
    for (let [key, val] of Object.entries(m.tags)) { v.onTag(m, key, val); }
    for (let [key, val] of Object.entries(m.attrs)) { v.onAttr(m, key, val); }
    for (let [key, val] of Object.entries(m.subs)) { v.onSub(m, key, val); }
    for (let [key, val] of Object.entries(m.rels)) { v.onRel(m, key, val); }
    m.list.forEach((item, idx) => v.onListItem(m, idx, item));
    v.endMeta(m)
}

// utils

export function firstMeta(ms: MetaList | Meta[]): Meta {
    return ms[0] || Nil;
}

export function firstAttr(ms: MetaList, name: string, otherwise?: string): string {
    return firstMeta(ms).attr(name, otherwise)
}

export function firstAttrOk(ms: MetaList, name: string): [string, boolean] {
    return firstMeta(ms).attrOk(name)
}

export function firstIs(ms: MetaList, kind: string, ns: string, ...tags: string[]): Meta {
    const ret = firstMeta(ms)
    return !ret.isNil() && ret.is(kind, ns, ...tags) ? ret : Nil;
}

function isEmpty(val: unknown): boolean {
    if (Array.isArray(val)) {
        return val.length === 0;
    } else if (val && typeof val === 'object') {
        return Object.keys(val).length === 0;
    } else {
        return !val;
    }
}

// partially cloned only, for readonly use 
export function toJson(m: Meta, expandPayload?: boolean): JsonMap {
    const ret: Json = { kind: m.kind };
    if (m.method) ret["method"] = m.method;
    if (m.ns) ret["ns"] = m.ns;
    if (m.gid) ret["gid"] = m.gid;

    if (m.payload !== undefined) {
        const pl = m.payload;
        if (expandPayload && typeof pl === 'string') {
            ret["payload"] = JSON.parse(pl) as Json;
        } else {
            ret["payload"] = m.payload as Json;
        }
    }

    isEmpty(m.tags) || (ret["tags"] = m.tags as Json);
    isEmpty(m.attrs) || (ret["attrs"] = m.attrs as Json);
    isEmpty(m.subs) || (ret["subs"] = toJsonMap(m.subs, expandPayload));
    isEmpty(m.rels) || (ret["subs"] = toJsonMap(m.rels, expandPayload));
    isEmpty(m.list) || (ret["list"] = m.list.map(it => toJson(it, expandPayload)));
    return ret;
}

export function toJsonMap(mmap: { [key: string]: Meta }, expandPayload?: boolean): JsonMap {
    return Object.fromEntries(
        Object.entries(mmap).map(([k, m]) => [k, toJson(m, expandPayload)])
    );
}

// errors

export enum HttpCode {
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER = 500,
}

export const HttpError = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    500: 'Internal server error',
}

export function newError(msg: string, code?: string | HttpCode) {
    const ret = newMeta({ kind: ErrorKind }, 'message', msg);
    return code === undefined ? ret : ret.withAttr('code', code + '');
}

export function notFound(msg?: string) {
    return newError(msg || HttpError[HttpCode.NOT_FOUND], HttpCode.NOT_FOUND);
}

export function unauthorized(msg?: string) {
    return newError(msg || HttpError[HttpCode.UNAUTHORIZED], HttpCode.UNAUTHORIZED);
}

export function badRequest(msg?: string) {
    return newError(msg || HttpError[HttpCode.BAD_REQUEST], HttpCode.BAD_REQUEST);
}

export function serverError(msg?: string) {
    return newError(msg || HttpError[HttpCode.INTERNAL_SERVER], HttpCode.INTERNAL_SERVER);
}

export const metaError = {
    newError, notFound, unauthorized, badRequest, serverError,
}
