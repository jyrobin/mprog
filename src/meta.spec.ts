
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { simpleMeta } from './meta.js';

test('meta.withAttr trim undefined', () => {
  let m = simpleMeta('Test').withAttr('a', 1, 'b', undefined); 
  assert.is(Object.keys(m.attrs).length, 1);
});

test.run();
