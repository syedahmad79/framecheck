import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SliderHandle } from './SliderHandle';

function Harness({ initial = 0.5 }: { initial?: number }) {
  const [position, setPosition] = useState(initial);
  return <SliderHandle position={position} onChange={setPosition} />;
}

describe('SliderHandle', () => {
  it('describes both sides of the divider to assistive technology', () => {
    render(<Harness initial={0.4} />);
    const slider = screen.getByRole('slider', { name: 'Comparison divider' });
    expect(slider).toHaveAttribute('aria-valuenow', '40');
    expect(slider).toHaveAttribute('aria-valuetext', 'Reference 40%, implementation 60%');
  });

  it('moves in 1% steps with arrows and 10% steps with Shift', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const slider = screen.getByRole('slider');
    slider.focus();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuenow', '52');
    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '51');
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(slider).toHaveAttribute('aria-valuenow', '41');
  });

  it('jumps to the ends with Home and End and never leaves the 0–100 range', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const slider = screen.getByRole('slider');
    slider.focus();

    await user.keyboard('{Home}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    await user.keyboard('{End}{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });
});
