// Component tests for PreAuthModal.svelte — the Google authorization safety explainer.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PreAuthModal from './PreAuthModal.svelte';

describe('PreAuthModal', () => {
  it('tells users to stop instead of bypassing an unverified-app warning', () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    const { getByText, queryByText } = render(PreAuthModal, { props: { onContinue, onCancel } });
    expect(getByText(/do not bypass the warning/i)).toBeInTheDocument();
    expect(getByText(/cannot read your inbox/i)).toBeInTheDocument();
    expect(queryByText('Advanced')).not.toBeInTheDocument();
    expect(queryByText(/go to sendarc \(unsafe\)/i)).not.toBeInTheDocument();
  });

  it('calls onContinue when the primary button is clicked', async () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    const { getByRole } = render(PreAuthModal, { props: { onContinue, onCancel } });
    await fireEvent.click(getByRole('button', { name: /open google sign-in/i }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    const { getByRole } = render(PreAuthModal, { props: { onContinue, onCancel } });
    await fireEvent.click(getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });
});
