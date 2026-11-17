import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeLoadFile, fakeProject, fakeRepository, pngFile } from '@/test/fakes';
import { HomeScreen } from './HomeScreen';

function setup(repository = fakeRepository()) {
  const onCompare = vi.fn();
  // userEvent's `upload` honours the accept attribute; disable that to test our own validation.
  const user = userEvent.setup({ applyAccept: false });
  render(<HomeScreen repository={repository} loadFile={fakeLoadFile} onCompare={onCompare} />);
  return { onCompare, user, repository };
}

const input = (role: 'reference' | 'implementation') => screen.getByTestId(`input-${role}`);

describe('HomeScreen', () => {
  it('starts with two empty slots, a disabled Compare button and an empty saved list', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Drop the reference screenshot/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Drop the implementation screenshot/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the sample comparison/ })).toHaveAttribute(
      'href',
      '#/sample',
    );
  });

  it('enables Compare once both images are chosen and hands over the pair', async () => {
    const { user, onCompare } = setup();
    await user.upload(input('reference'), pngFile('design.png'));
    expect(await screen.findByText('design.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();

    await user.upload(input('implementation'), pngFile('build.png'));
    const compare = screen.getByRole('button', { name: 'Compare' });
    await waitFor(() => expect(compare).toBeEnabled());
    expect(compare).toHaveFocus();

    await user.click(compare);
    expect(onCompare).toHaveBeenCalledTimes(1);
    const pair = onCompare.mock.calls[0]?.[0] as {
      reference: { name: string };
      implementation: { name: string };
    };
    expect(pair.reference.name).toBe('design.png');
    expect(pair.implementation.name).toBe('build.png');
  });

  it('explains why an unsupported file was rejected and keeps Compare disabled', async () => {
    const { user } = setup();
    await user.upload(input('reference'), new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('“notes.txt” is not a PNG or JPEG image');
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
  });

  it('fills both slots when two files are dropped on one slot', async () => {
    setup();
    fireEvent.drop(screen.getByTestId('slot-reference'), {
      dataTransfer: { files: [pngFile('one.png'), pngFile('two.png')], types: ['Files'] },
    });
    expect(
      await within(screen.getByTestId('slot-reference')).findByText('one.png'),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByTestId('slot-implementation')).findByText('two.png'),
    ).toBeInTheDocument();
  });

  it('refuses more than two dropped files with a clear message', async () => {
    setup();
    fireEvent.drop(screen.getByTestId('slot-reference'), {
      dataTransfer: {
        files: [pngFile('1.png'), pngFile('2.png'), pngFile('3.png')],
        types: ['Files'],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('You dropped 3 files');
  });

  it('swaps and removes images', async () => {
    const { user } = setup();
    await user.upload(input('reference'), pngFile('design.png'));
    await screen.findByText('design.png');

    await user.click(screen.getByRole('button', { name: 'Swap reference and implementation' }));
    expect(
      within(screen.getByTestId('slot-implementation')).getByText('design.png'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Implementation image' }));
    expect(screen.queryByText('design.png')).not.toBeInTheDocument();
  });

  it('lists saved comparisons and deletes one only after confirmation', async () => {
    const repository = fakeRepository([
      fakeProject('p1', 'Checkout'),
      fakeProject('p2', 'Pricing'),
    ]);
    const { user } = setup(repository);

    expect(await screen.findByRole('link', { name: /Checkout/ })).toHaveAttribute('href', '#/p/p1');
    await user.click(screen.getByRole('button', { name: 'Delete Checkout' }));
    expect(repository.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm deleting Checkout' }));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Checkout/ })).not.toBeInTheDocument(),
    );
    expect(repository.remove).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('link', { name: /Pricing/ })).toBeInTheDocument();
  });

  it('shows a storage error instead of an empty list', async () => {
    const repository = fakeRepository();
    repository.list.mockRejectedValueOnce(new Error('Local storage may be unavailable.'));
    setup(repository);
    expect(await screen.findByRole('alert')).toHaveTextContent('Local storage may be unavailable.');
  });
});
