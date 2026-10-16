import React from 'react';
import {afterEach, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {executePlugin} from '../loader';
import {hostModulesFor} from '../api';
import {LEDGER_PLUGIN_FILES, ledgerManifest, loadLedgerPlugin} from './ledgerPluginFixture';

afterEach(cleanup);

it('keeps the public table region keyboard-focusable and labelled through the zip loader', () => {
  const {api} = loadLedgerPlugin();
  const exports = executePlugin({
    manifest: {...ledgerManifest, main: 'src/reportShell.tsx'},
    files: LEDGER_PLUGIN_FILES,
  }, hostModulesFor(api));
  const TableRegion = exports.TableRegion as React.ComponentType<{label: string; children: React.ReactNode; regionRef: React.Ref<HTMLDivElement>}>;
  const regionRef = React.createRef<HTMLDivElement>();
  render(<TableRegion label="Account balances" regionRef={regionRef}><table><tbody><tr><td>42</td></tr></tbody></table></TableRegion>);
  const region = screen.getByRole('region', {name: 'Account balances'});
  expect(region.classList.contains('obe-ui-table-wrap')).toBe(true);
  expect(region.tabIndex).toBe(0);
  expect(regionRef.current).toBe(region);
  expect(region.querySelector('td')?.textContent).toBe('42');
});
