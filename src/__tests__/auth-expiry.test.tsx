import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { expect, describe, it, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

function TestConsumer() {
  const { user } = useAuth();
  return <div>{user ? `logged:${user.email}` : 'logged:anonymous'}</div>;
}

describe('Auth expiry sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears user on auth-expired event', async () => {
    // seed localStorage with token and user
    localStorage.setItem('fuelsync_token', 'dummy');
    localStorage.setItem('fuelsync_user', JSON.stringify({ email: 'test@example.com' }));

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByText(/logged:/)).toBeInTheDocument();

    // dispatch auth-expired
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth-expired'));
    });

    expect(screen.getByText('logged:anonymous')).toBeInTheDocument();
  });

  it('clears user on storage token removal across tabs', async () => {
    localStorage.setItem('fuelsync_token', 'dummy');
    localStorage.setItem('fuelsync_user', JSON.stringify({ email: 'test2@example.com' }));

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByText(/logged:/)).toBeInTheDocument();

    // Simulate storage event where token is removed in another tab
    await act(async () => {
      const event = new StorageEvent('storage', {
        key: 'fuelsync_token',
        oldValue: 'dummy',
        newValue: null,
      } as any);
      window.dispatchEvent(event);
    });

    expect(screen.getByText('logged:anonymous')).toBeInTheDocument();
  });
});
