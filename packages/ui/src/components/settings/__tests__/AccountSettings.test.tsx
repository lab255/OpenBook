import React from 'react';
import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import AccountSettings from '../AccountSettings';

const state = vi.hoisted(() => ({
  ableMode: false,
  status: 'disconnected',
}));

const copy: Record<string, string> = {
  'account.signin.title': 'Account & sync',
  'account.signin.description': 'Sign in to account.book.pub to sync your preferences and libraries across devices.',
  'account.signin.signInButton': 'Continue with account.book.pub',
  'account.signin.connecting': 'Waiting for sign-in in your browser…',
  'account.signin.able.description': 'Sign in to OpenBook to use your verified identity on this library.',
  'account.signin.able.signInButton': 'Sign in',
  'account.signin.able.connecting': 'Signing you in…',
  'account.signin.able.whatSyncs': 'OpenBook uses your sign-in only to verify who you are on this library.',
};

vi.mock('@/providers', () => ({
  useTranslation: () => ({t: (key: string) => copy[key] ?? key}),
  useAccount: () => ({
    ...state,
    accounts: [],
    error: null,
    identityExpired: false,
    signIn: vi.fn(),
    submitCode: vi.fn(),
    cancel: vi.fn(),
    syncNow: vi.fn(),
  }),
}));

vi.mock('@/components/settings/primitives', () => ({
  SettingsScreen: ({description, children}: {description: string; children: React.ReactNode}) => (
    <div><p>{description}</p>{children}</div>
  ),
  SettingsSection: ({children}: {children: React.ReactNode}) => <section>{children}</section>,
}));

vi.mock('@/components/settings/AccountSwitcher', () => ({default: () => <div>switcher</div>}));

describe('AccountSettings able whitelabel copy', () => {
  beforeEach(() => {
    state.ableMode = false;
    state.status = 'disconnected';
  });

  it('keeps account.book.pub copy when delegated sign-in is inactive', () => {
    render(<AccountSettings />);

    expect(screen.getByRole('button', {name: 'Continue with account.book.pub'})).toBeTruthy();
    expect(screen.getByText(/Sign in to account\.book\.pub/)).toBeTruthy();
  });

  it('switches to neutral OpenBook copy when the cached able probe succeeds', () => {
    state.ableMode = true;
    const view = render(<AccountSettings />);

    expect(screen.getByRole('button', {name: 'Sign in'})).toBeTruthy();
    expect(screen.getByText(/Sign in to OpenBook/)).toBeTruthy();
    expect(view.container.textContent).not.toContain('account.book.pub');
    expect(view.container.textContent).not.toContain('account.able.online');

    state.status = 'connecting';
    view.rerender(<AccountSettings />);
    expect(screen.getByText('Signing you in…')).toBeTruthy();
  });
});
