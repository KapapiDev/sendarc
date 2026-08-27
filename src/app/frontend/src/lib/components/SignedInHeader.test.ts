import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SignedInHeader from './SignedInHeader.svelte';

describe('SignedInHeader', () => {
  it('renders SendArc and prefers the account email over the profile name', () => {
    const { getByText } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: 'Alice', onSignOut: vi.fn() },
    });
    expect(getByText('SendArc')).toBeInTheDocument();
    expect(getByText('a@b.com')).toBeInTheDocument();
  });

  it('falls back to the profile name, then a generic account label', () => {
    const named = render(SignedInHeader, {
      props: { email: '', name: 'Alice', onSignOut: vi.fn() },
    });
    expect(named.getByText('Alice')).toBeInTheDocument();
    named.unmount();

    const generic = render(SignedInHeader, {
      props: { email: '', name: '', onSignOut: vi.fn() },
    });
    expect(generic.getByText('your Google account')).toBeInTheDocument();
  });

  it('calls onSignOut when Sign out is clicked', async () => {
    const onSignOut = vi.fn();
    const { getByRole } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut },
    });
    await fireEvent.click(getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('does not render any automatic-mode controls', () => {
    const { queryByRole, queryByText } = render(SignedInHeader, {
      props: { email: 'a@b.com', name: '', onSignOut: vi.fn() },
    });
    expect(queryByRole('group', { name: /mode/i })).toBeNull();
    expect(queryByText(/auto-draft/i)).toBeNull();
  });
});
