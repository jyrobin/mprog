import { Map, List, Record } from 'immutable';

const Truth = Map<string, boolean>({
	'1': true, 'true': true, 'yes': true, 'on': true,
	'0': false, 'false': false, 'no': false, 'off': false,
});

export const ErrorKind = 'Error';

export type StrMap = Map<string, string>
export type MetaMap = Map<string, Meta>
export type MetaList = List<Meta>

export type MetaType = {
	kind?: string
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

export interface Meta {
	kind: string
	method: string
	ns: string
	gid: string
	tags: StrMap
	attrs: StrMap
	payload: string
	subs: MetaMap,
	rels: MetaMap,
	list: MetaList,

	isNil(): boolean

	tag(name: string): string|undefined
	hasTag(...args: string[]): boolean
	hasTags(tags: StrMap): boolean 
	is(kind: string, ns: string, ...tags: string[]): boolean

	attr(name: string): string|undefined
	hasAttr(...args: string[]): boolean
	hasAttrs(attrs: StrMap): boolean
	intAttr(name: string, otherwise?: number): number
	boolAttr(name: string): boolean|undefined
	isTrueAttr(name: string): boolean
	isFalseAttr(name: string): boolean
	floatAttr(name: string, otherwise?: number): number
	dateAttr(name: string): Date|undefined
	intsAttr(name: string, sep?: string, skip?: boolean): number[]|undefined
	floatsAttr(name: string, sep?: string, skip?: boolean): number[]|undefined

	isError(): boolean
	isValid(): boolean

	withMethod(mthd: string): Meta
	withGid(gid: string): Meta

	withTag(name: string, value: string, ...rest: string[]): Meta
	withTags(tags: StrMap): Meta
	withAttr(...args: string[]): Meta
	withAttrs(attrs: StrMap): Meta

	withPayload(data: string): Meta

	withSub(name: string, sub: Meta): Meta
	withSubs(subs: MetaMap): Meta
	hasSub(name: string): boolean
	sub(name: string): Meta

	withRel(name: string, rel: Meta): Meta
	withRels(rels: MetaMap): Meta
	hasRel(name: string): boolean
	rel(name: string): Meta

	withList(list: MetaList, trims?: boolean): Meta

	generalizes(m: Meta): boolean
	specializes(m: Meta): boolean

	walk(v: Visitor): void
	//json(...opts: string[]): string
}

export function simpleMeta(kind: string, method?: string, ...tags: string[]) {
	return new MetaRecord({
		kind, method, tags: toStrMap(tags),
	});
}
export function newMeta(mt: MetaType, ...attrs: string[]): Meta {
	let ret = new MetaRecord(mt);
	return attrs.length > 0 ? ret.withAttr(...attrs) : ret;
}
export function newError(msg: string, code?: string) {
	let ret = newMeta({kind: ErrorKind}, 'msg', msg);
	return code ? ret.withAttr('code', code) : ret;
}

export class MetaRecord extends Record({
	kind: '',
	method: '',
	ns: '',
	gid: '',
	payload: '',
	tags: Map<string, string>() as StrMap,
	attrs: Map<string, string>() as StrMap,
	subs: Map<string, Meta>() as MetaMap,
	rels: Map<string, Meta>() as MetaMap,
	list: List<Meta>() as MetaList,
}) implements Meta {
	constructor(mt: MetaType) {
		super(mt);
	}

	isNil() {
		return !this.kind;
	}
	tag(name: string) {
		return this.tags.get(name);
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
	attr(name: string) {
		return this.attrs.get(name);
	}
	hasAttr(...args: string[]) {
		return hasValue(this.attrs, args);
	}
	hasAttrs(ts: StrMap) {
		return hasValues(this.attrs, ts)
	}
	intAttr(name: string, otherwise?: number) {
		return toInt(this.attr(name), otherwise);
	}
	boolAttr(name: string) {
		let attr = this.attr(name);
		return attr ? Truth.get(attr.toLowerCase()) : undefined;
	}
	isTrueAttr(name: string) {
		return this.boolAttr(name) || false;
	}

	isFalseAttr(name: string) {
		let key = this.attr(name)?.toLowerCase();
		return key && Truth.has(key) && Truth.get(key) || false; 
	}
	floatAttr(name: string, otherwise?: number) {
		return toNumber(this.attr(name), otherwise);
	}

	dateAttr(name: string) {
			let attr = this.attr(name);
			if (attr) {
				let d = new Date(attr);
				if (d instanceof Date) {
					return d;
				}
			}

		return undefined;
	}

	intsAttr(name: string, sep?: string, skip?: boolean) {
		return splitNumbers(this.attr(name), toInt, sep, skip);
	}

	floatsAttr(name: string, sep?: string, skip?: boolean) {
		return splitNumbers(this.attr(name), toNumber, sep, skip);
	}

	// meta

	isError() {
		return this.kind === ErrorKind;
	}
	isValid() {
		return !!this.kind && this.kind !== ErrorKind;
	}

	withMethod(mthd: string) {
		return this.set('method', mthd);
	}

	withGid(gid: string) {
		return this.set('gid', gid);
	}

	withTag(...args: string[]) {
		return this.withTags(toStrMap(args));
	}

	withTags(ts: StrMap) {
		return this.set('tags', this.tags.merge(ts));
	}

	withAttr(...args: string[]) {
		return this.withAttrs(toStrMap(args));
	}

	withAttrs(attrs: StrMap) {
		return this.set('attrs', this.attrs.merge(attrs));
	}

	withPayload(payload: string) {
		return this.set('payload', payload);
	}

	sub(name: string): Meta {
		return this.subs.get(name) || Nil;
	}
	hasSub(name: string) {
		return this.subs.has(name);
	}
	withSub(name: string, sub: Meta) {
		return this.set("subs", this.subs.set(name, sub));
	}
	withSubs(subs: MetaMap) {
		return this.set("subs", this.subs.merge(subs));
	}

	rel(name: string): Meta {
		return this.rels.get(name) || Nil;
	}
	hasRel(name: string) {
		return this.rels.has(name);
	}
	withRel(name: string, rel: Meta) {
		return this.set("rels", this.rels.set(name, rel));
	}
	withRels(rels: MetaMap) {
		return this.set("rels", this.rels.merge(rels));
	}

	withList(list: MetaList, trims?: boolean) {
		if (trims) {
			list = list.filter(item => !!item);
		}
		return this.set('list', list);
	}

	listItem(idx: number) {
		return this.list.get(idx);
	}

	generalizes(n: Meta): boolean {
		if (this.kind == n.kind) {
			for (let [k, v] of this.tags) {
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

	// traverse

	walk(v: Visitor) {
		walk(this, v);
	}
}

function hasValue(vals: StrMap, args: string[]): boolean {
	let argn = args.length;
	for (let i=0, n=argn/2; i < n; i++) {
		let key = args[2*i];
		if (!vals.has(key) || vals.get(key) !== args[2*i+1]) {
			return false
		}
	}
	return argn%2 === 0 || vals.has(args[argn-1]);
}

function hasValues(vals: StrMap, ts: StrMap): boolean {
	for(let [key, value] of ts) {
		if (vals.get(key) !== value) {
			return false;
		}
	}
	return true;
}

export function toStrMap(args: string[]): StrMap {
	let ret = Map<string, string>();
	for (let i=1, n=args.length; i < n; i+=2) {
		ret = ret.set(args[i-1], args[i]);
	}
	return ret;
}

function toNumber(s: string|undefined, otherwise?: number): number {
	let ret = s ? Number(s) : NaN;
	return (isNaN(ret) && otherwise !== undefined) ? otherwise : ret;
}
function toInt(s: string|undefined, otherwise?: number): number {
	let ret = s ? Number(s) : NaN;
	if (!isNaN(ret) && s && ret === parseInt(s)) {
		return ret;
	}
	return otherwise === undefined ? NaN : Math.floor(otherwise);
}
function splitNumbers(s: string|undefined, fn: ((s: string) => number), sep?: string, skip?: boolean): number[]|undefined {
	if (!s) return skip ? [] : undefined;

	let words = s.split(sep || ',');
	let ret = words.map(w => fn(w)).filter(n => !isNaN(n));
	return skip || words.length === ret.length ? ret : undefined;
}

export const Nil: Meta = new MetaRecord({});

export interface Visitor {
	beginMeta(m: Meta, kind: string, method: string, ns: string, gid: string): void;
	onTag(m: Meta, name: string, value: string): void
	onAttr(m: Meta, name: string, value: string): void
	onSub(m: Meta, name: string, sub: Meta): void
	onRel(m: Meta, name: string, rel: Meta): void
	onListItem(m: Meta, index: number, item: Meta): void
	endMeta(m: Meta): void
}

function walk(m: Meta, v: Visitor) {
	v.beginMeta(m, m.kind, m.method, m.ns, m.gid)
	m.tags.forEach((tag, name) => v.onTag(m, name, tag));
	m.attrs.forEach((attr, name) => v.onAttr(m, name, attr));
	m.subs.forEach((sub, name) => v.onSub(m, name, sub));
	m.rels.forEach((rel, name) => v.onRel(m, name, rel));
	m.list.forEach((item, idx) => v.onListItem(m, idx, item))
	v.endMeta(m)
}

// utils

export function first(ms: MetaList): Meta {
	return ms.get(0) || Nil;
}

export function firstAttr(ms: MetaList, name: string): string|undefined {
	return first(ms).attr(name)
}

export function firstIs(ms: MetaList, kind: string, ns: string, ...tags: string[]): Meta {
	let ret = first(ms)
	return !ret.isNil() && ret.is(kind, ns, ...tags) ? ret : Nil;
}
