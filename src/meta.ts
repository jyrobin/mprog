import exp from "constants";

export const ErrorKind = 'Error';

export type Attr = string | number | boolean | null |
	Readonly<string[]> | Readonly<number[]> | Readonly<boolean[]>;

export type Json = string | number | boolean | null |
	Json[] | { [key: string]: Json };
export type JsonMap = { [key: string]: Json };
export type AnyMap = { [key: string]: any };

export type StrStrMap = { [key: string]: string }
export type StrAttrMap = { [key: string]: Attr }
export type StrDomMap = { [key: string]: StrAttrMap } // key is domain URI
export type StrMetaMap = { [key: string]: Meta }
export type StrMap = Readonly<StrStrMap>
export type AttrMap = Readonly<StrAttrMap>
export type DomMap = Readonly<{ [key: string]: AttrMap }>
export type MetaMap = Readonly<StrMetaMap>
export type MetaList = Readonly<Meta[]>

export interface Mpi {
	call(method: string, meta: Meta, ctx?: MetaMap): Promise<Meta>
	ctrl(method: string, meta?: Meta, ctx?: MetaMap): Promise<Meta>
}

export const NilMpi = {
	async call(method: string, meta: Meta, ctx?: MetaMap) {
		return Nil;
	},
	async ctrl(method: string, meta?: Meta, ctx?: MetaMap) {
		return Nil;
	},
}

export type MetaType = {
	kind: string
	method?: string
	ns?: string
	gid?: string
	payload?: Attr
	tags?: StrMap
	attrs?: AttrMap
	doms?: DomMap
	subs?: MetaMap
	rels?: MetaMap
	list?: MetaList
}

export interface Meta {
	readonly kind: string
	readonly method?: string
	readonly ns?: string
	readonly gid?: string
	readonly payload?: Attr
	readonly tags: StrMap
	readonly attrs: AttrMap
	readonly doms: DomMap
	readonly subs: MetaMap
	readonly rels: MetaMap
	readonly list: MetaList

	isNil(): boolean

	tag(name: string): string|undefined
	hasTag(...args: string[]): boolean
	hasTags(tags: StrStrMap): boolean 
	is(kind: string, ns: string, ...tags: string[]): boolean

	attr(name: string): Attr|undefined
	hasAttr(...args: string[]): boolean
	hasAttrs(attrs: StrAttrMap): boolean
	dateAttr(name: string): Date|undefined
	domAttrs(uri: string): AttrMap|undefined 

	isError(): boolean
	parseError(defaultCode: number): [string, number]
	isValid(): boolean

	withMethod(mthd: string): Meta
	withGid(gid: string): Meta
	withPayload(data: string): Meta

	setTag(name: string, value: string, ...rest: string[]): Meta
	withTag(name: string, value: string, ...rest: string[]): Meta
	setTags(tags: StrStrMap): Meta
	withTags(tags: StrStrMap): Meta
	setAttr(...args: (string|null|undefined)[]): Meta
	withAttr(...args: (string|null|undefined)[]): Meta
	setAttrs(attrs: StrAttrMap): Meta
	withAttrs(attrs: StrAttrMap): Meta

	setDomAttr(uri: string, ...args: string[]): Meta
	setDomAttrs(uri: string, attrs: StrAttrMap): Meta

	withSub(name: string, sub: Meta): Meta
	withSubs(subs: StrMetaMap): Meta
	hasSub(name: string): boolean
	sub(name: string): Meta

	withRel(name: string, rel: Meta): Meta
	withRels(rels: StrMetaMap): Meta
	hasRel(name: string): boolean
	rel(name: string): Meta

	setList(list: Meta[], trims?: boolean): Meta

	generalizes(m: Meta): boolean
	specializes(m: Meta): boolean

	walk(v: Visitor): void
	json(...opts: string[]): string

	object(expandPayload?: boolean): AnyMap
}

export function simpleMeta(kind: string, method?: string, ...tags: string[]) {
	return new SimpleMeta({
		kind, method, tags: arrayToStrMap(tags),
	});
}
export function newMeta(mt: MetaType, ...attrs: (string|null|undefined)[]): Meta {
	let ret = new SimpleMeta(mt);
	return attrs.length > 0 ? ret.withAttr(...attrs) : ret;
}
export function newError(msg: string, code?: string|number) {
	let ret = newMeta({kind: ErrorKind}, 'message', msg);
    return code === undefined ? ret : ret.withAttr('code', code + '');
}

export function parseMeta(str: string): Meta {
	let obj = JSON.parse(str);
	return toMeta(obj);
} 

export function toMeta(obj: any): Meta {
	let { kind, method, ns, gid, payload, tags, attrs, doms, subs, rels, list } = obj;
	return new SimpleMeta({
		kind, method, ns, gid, payload,
		tags: tags ? toStrMap(tags) : undefined,
		attrs: attrs ? toStrMap(attrs) : undefined,
		doms: doms ? toDomMap(doms) : undefined, 
		subs: subs ? toMetaMap(subs) : undefined,
		rels: rels ? toMetaMap(rels) : undefined,
		list: list ? toMetaList(list) : undefined,
	});
}

export function toMetaMap(obj: unknown): MetaMap|undefined {
	if (obj && typeof obj === 'object') {
		let ret: StrMetaMap = {};
		for (let [k, v] of Object.entries(obj)) {
			ret[k] = toMeta(v);
		}
		return ret;
	}
} 

export function toMetaList(obj: any): MetaList {
	return obj.map(toMeta);
}

export class SimpleMeta implements Meta {
	readonly kind: string
	readonly method?: string
	readonly ns?: string
	readonly gid?: string
	readonly payload?: Attr 
	readonly tags: StrMap
	readonly attrs: AttrMap
	readonly doms: DomMap
	readonly subs: MetaMap
	readonly rels: MetaMap
	readonly list: MetaList 
	constructor(mt: MetaType) {
		const { kind, method, ns, gid, payload, tags, attrs, doms, subs, rels, list } = mt;
		this.kind = kind;
		method && (this.method = method);
		ns && (this.ns = ns);
		gid && (this.gid = gid);
		payload && (this.payload = payload);
		this.tags = tags || {};
		this.attrs = attrs || {};
		this.doms = doms || {};
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
	hasTags(ts: StrStrMap) {
		return hasValues(this.tags, ts)
	}
	is(kind: string, ns?: string, ...tags: string[]) {
		return this.kind === kind && this.ns === (ns || '') && this.hasTag(...tags);
	}
	attr(name: string) {
		return this.attrs[name];
	}
	hasAttr(...args: string[]) {
		return hasValue(this.attrs, args);
	}
	hasAttrs(ts: StrMap) {
		return hasValues(this.attrs, ts)
	}

	dateAttr(name: string) {
		let attr = this.attr(name);
		if (typeof attr === 'string') {
			let d = new Date(attr);
			if (d instanceof Date) {
				return d;
			}
		}

		return undefined;
	}

	domAttrs(uri: string) {
		return this.doms[uri];
	}

	// meta

	isError() {
		return this.kind === ErrorKind;
	}
	parseError(defaultCode: number): [string, number] {
		let msg = this.attr('message');
		let code = Number(this.attr('code'));
		if (isNaN(code)) code = defaultCode;
		return [msg?.toString() || '', code];
	}

	isValid() {
		return !this.isNil() && !this.isError();
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
		let tags = arrayToStrMap(args);
		return new SimpleMeta({ ...this, tags });
	}
	withTag(...args: string[]) {
		if (args.length === 0) return this;

		let tags = { ...this.tags, ...arrayToStrMap(args) };
		return new SimpleMeta({ ...this, tags });
	}
	setTags(tags: StrStrMap) {
		return new SimpleMeta({ ...this, tags });
	}
	withTags(tagMap: StrStrMap) {
		if (isEmpty(tagMap)) return this;

		let tags = { ...this.tags, ...tagMap };
		return new SimpleMeta({ ...this, tags });
	}

	setAttr(...args: (string|undefined|null)[]) {
		let attrs = arrayToStrMap(args);
		return new SimpleMeta({ ...this, attrs });
	}
	withAttr(...args: (string|undefined|null)[]) {
		if (args.length === 0) return this;

		let attrs = { ...this.attrs, ...arrayToStrMap(args) };
		return new SimpleMeta({ ...this, attrs });
	}
	setAttrs(attrs: StrMap) {
		return new SimpleMeta({ ...this, attrs });
	}
	withAttrs(attrMap: StrMap) {
		if (isEmpty(attrMap)) return this;

		let attrs = { ...this.attrs, ...attrMap };
		return new SimpleMeta({ ...this, attrs });
	}

	setDomAttr(uri: string, ...args: string[]) {
		return new SimpleMeta({
			...this,
			doms: setDomMap(this.doms, uri, arrayToStrMap(args)),
		});
	}
	setDomAttrs(uri: string, attrs: StrAttrMap) {
		return new SimpleMeta({
			...this,
			doms: setDomMap(this.doms, uri, attrs), 
		});
	}

	sub(name: string): Meta {
		return this.subs[name] || Nil;
	}
	hasSub(name: string) {
		return !!this.subs[name];
	}
	withSub(name: string, sub: Meta) {
		let subs = { ...this.subs, [name]: sub };
		return new SimpleMeta({ ...this, subs });
	}
	withSubs(subMap: MetaMap) {
		let subs = { ...this.subs, ...subMap };
		return new SimpleMeta({ ...this, subs });
	}

	rel(name: string): Meta {
		return this.rels[name] || Nil;
	}
	hasRel(name: string) {
		return !!this.rels[name];
	}
	withRel(name: string, rel: Meta) {
		let rels = { ...this.rels, [name]: rel };
		return new SimpleMeta({ ...this, rels });
	}
	withRels(relMap: MetaMap) {
		let rels = { ...this.rels, ...relMap };
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
		return JSON.stringify(this, null, opts[0]);
	}

	object(expandPayload?: boolean): AnyMap {
		return toJson(this, expandPayload);
	}

	// traverse

	walk(v: Visitor) {
		walk(this, v);
	}
}

export function toStrMap(obj: any): StrMap {
	let ret: StrStrMap = {};
	for (let [k, v] of Object.entries(obj)) {
		if (typeof v === 'string') {
			ret[k] = v;
		}
	}
	return ret;
}

export function toDomMap(obj: any): DomMap {
	let ret: StrDomMap = {};
	for (let [k, v] of Object.entries(obj)) {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			ret[k] = toStrMap(v);
		}
	}
	return ret;
}

export function arrayToStrMap(args: (string|undefined|null)[]): StrMap {
	let ret: StrStrMap = {};
	for (let i=1, n=args.length; i < n; i+=2) {
		let k = args[i-1];
		let v = args[i];
		if (k != null && v != null) {
			ret[k] = v;
		}
	}
	return ret;
}

function hasValue(vals: AttrMap, args: string[]): boolean {
	let argn = args.length;
	for (let i=0, n=argn/2; i < n; i++) {
		let key = args[2*i];
		let val = vals[key];
		if (val === undefined || val !== args[2*i+1]) {
			return false
		}
	}
	return argn%2 === 0 || vals[args[argn-1]] !== undefined;
}

function hasValues(vals: AttrMap, ts: StrMap): boolean {
	for(let [key, value] of Object.entries(ts)) {
		if (vals[key] !== value) {
			return false;
		}
	}
	return true;
}

export function setDomMap(old: DomMap, key: string, val: AttrMap): DomMap {
	let ret: StrDomMap = {};
	for (let [k, v] of Object.entries(old)) {
		ret[k] = v;
	}
	ret[key] = val;
	return ret;
}

export const Nil: Meta = new SimpleMeta({kind: ''});

export interface Visitor {
	beginMeta(m: Meta, kind: string, method?: string, ns?: string, gid?: string): void;
	onTag(m: Meta, name: string, value: string): void
	onAttr(m: Meta, name: string, value: Attr): void
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

export function firstAttr(ms: MetaList, name: string): Attr|undefined {
	return firstMeta(ms).attr(name)
}

export function firstIs(ms: MetaList, kind: string, ns: string, ...tags: string[]): Meta {
	let ret = firstMeta(ms)
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
	let ret: Json = { kind: m.kind };
	if (m.method) ret.method = m.method; 
	if (m.ns) ret.ns = m.ns; 
	if (m.gid) ret.gid = m.gid; 

	if (m.payload !== undefined) {
		let pl = m.payload;
		if (expandPayload && typeof pl === 'string') {
			ret.payload = JSON.parse(pl) as Json;
		} else {
			ret.payload = m.payload as Json;
		}
	}

	isEmpty(m.tags) || (ret.tags = m.tags as Json);
	isEmpty(m.attrs) || (ret.attrs = m.attrs as Json);
	isEmpty(m.doms) || (ret.doms = m.doms as Json); 
	isEmpty(m.subs) || (ret.subs = toJsonMap(m.subs, expandPayload));
	isEmpty(m.rels) || (ret.subs = toJsonMap(m.rels, expandPayload)); 
	isEmpty(m.list) || (ret.list = m.list.map(it => toJson(it, expandPayload)));
	return ret;
}

export function toJsonMap(mmap: { [key: string]: Meta }, expandPayload?: boolean): JsonMap {
	return Object.fromEntries(
		Object.entries(mmap).map(([k, m]) => [k, toJson(m, expandPayload)])
	);
}
