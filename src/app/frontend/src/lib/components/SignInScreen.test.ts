// Component tests for SignInScreen.svelte — renders the welcome screen + sign-in button.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SignInScreen from './SignInScreen.svelte';

describe('SignInScreen', () => {
  it('renders the welcome heading and sign-in button copy', () => {
    const onSignIn = vi.fn();
    const onAbout = vi.fn();
    const { getByRole, getByText } = render(SignInScreen, { props: { onSignIn, onAbout, onStatus: vi.fn() } });
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('SendArc');
    expect(getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(getByText(/never sends in the background/i)).toBeInTheDocument();
  });

  it('calls onSignIn when the sign-in button is clicked', async () => {
    const onSignIn = vi.fn();
    const onAbout = vi.fn();
    const { getByRole } = render(SignInScreen, { props: { onSignIn, onAbout, onStatus: vi.fn() } });
    const btn = getByRole('button', { name: /sign in with google/i });
    await fireEvent.click(btn);
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('opens About from the signed-out screen', async () => {
    const onAbout = vi.fn();
    const { getByRole } = render(SignInScreen, { props: { onSignIn: vi.fn(), onAbout, onStatus: vi.fn() } });
    await fireEvent.click(getByRole('button', { name: /about, privacy & licenses/i }));
    expect(onAbout).toHaveBeenCalledOnce();
  });

  it('opens Status from the signed-out screen', async () => {
    const onStatus = vi.fn();
    const { getByRole } = render(SignInScreen, {
      props: { onSignIn: vi.fn(), onAbout: vi.fn(), onStatus },
    });
    await fireEvent.click(getByRole('button', { name: /^status$/i }));
    expect(onStatus).toHaveBeenCalledOnce();
  });
});
