import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SignedInHeader from './SignedInHeader.svelte';

describe('SignedInHeader', () => {
  it('renders SendArc and prefers the account email over the profile name', () => {
    const { getByText } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: 'Alice', onSignOut: vi.fn(), onOpenLogs: vi.fn(), onAbout: vi.fn() },
    });
    expect(getByText('SendArc')).toBeInTheDocument();
    expect(getByText('a@b.com')).toBeInTheDocument();
  });

  it('falls back to the profile name, then a generic account label', () => {
    const named = render(SignedInHeader, {
      props: { email: '', name: 'Alice', onSignOut: vi.fn(), onOpenLogs: vi.fn(), onAbout: vi.fn() },
    });
    expect(named.getByText('Alice')).toBeInTheDocument();
    named.unmount();

    const generic = render(SignedInHeader, {
      props: { email: '', name: '', onSignOut: vi.fn(), onOpenLogs: vi.fn(), onAbout: vi.fn() },
    });
    expect(generic.getByText('your Google account')).toBeInTheDocument();
  });

  it('calls onSignOut when Sign out is clicked', async () => {
    const onSignOut = vi.fn();
    const { getByRole } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut, onOpenLogs: vi.fn(), onAbout: vi.fn() },
    });
    await fireEvent.click(getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('opens the diagnostic log from the header', async () => {
    const onOpenLogs = vi.fn();
    const { getByRole } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut: vi.fn(), onOpenLogs, onAbout: vi.fn() },
    });
    await fireEvent.click(getByRole('button', { name: /open logs/i }));
    expect(onOpenLogs).toHaveBeenCalledOnce();
  });

  it('opens About from the signed-in header', async () => {
    const onAbout = vi.fn();
    const { getByRole } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut: vi.fn(), onOpenLogs: vi.fn(), onAbout },
    });
    await fireEvent.click(getByRole('button', { name: /^about$/i }));
    expect(onAbout).toHaveBeenCalledOnce();
  });

  it('does not render any automatic-mode controls', () => {
    const { queryByRole, queryByText } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut: vi.fn(), onOpenLogs: vi.fn(), onAbout: vi.fn() },
    });
    expect(queryByRole('group', { name: /mode/i })).toBeNull();
    expect(queryByText(/auto-draft/i)).toBeNull();
  });
});
