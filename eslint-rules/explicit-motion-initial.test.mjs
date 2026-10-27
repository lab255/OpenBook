import assert from 'node:assert/strict';
import test from 'node:test';
import {Linter} from 'eslint';
import plugin from './explicit-motion-initial.mjs';
const config = {languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}}, plugins: {motion: plugin}, rules: {'motion/explicit-initial': 'error'}};
const lint = code => new Linter().verify(code, config);
test('motion initial red/green: direct, alias, lazy, factory, spread', () => {
  for (const [prefix, tag] of [['', 'motion.div'], ['', 'm.div'], ['import {m as lazy} from "motion/react";', 'lazy.div'], ['import * as m from "motion/react-m";', 'm.div'], ['const Box = motion.create(Component);', 'Box']]) {
    const red = lint(`${prefix} <${tag} {...props} />;`);
    assert.equal(red[0]?.messageId, 'initial');
    assert.equal(red[0]?.severity, 2);
    assert.deepEqual(lint(`${prefix} <${tag} initial={false} {...props} />;`), []);
  }
  assert.deepEqual(lint('<div />;'), []);
});

test('forbids eager motion and domMax imports in block/viewer code', () => {
  for (const code of ['import {motion} from "motion/react";', 'import {domMax} from "motion/react";', 'import * as Motion from "motion/react";']) assert.equal(lint(code)[0]?.messageId, 'subset');
  assert.deepEqual(lint('import {LazyMotion, domAnimation, m} from "motion/react";'), []);
});
