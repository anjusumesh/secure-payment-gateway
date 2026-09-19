import type { CSSProperties } from 'react';

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
}

export function QuantityStepper({ quantity, onChange }: QuantityStepperProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(quantity - 1)}
        style={stepperButtonStyle}
      >
        −
      </button>
      <span style={{ minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {String(quantity).padStart(2, '0')}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(quantity + 1)}
        style={stepperButtonStyle}
      >
        +
      </button>
    </div>
  );
}

const stepperButtonStyle: CSSProperties = {
  border: 'none',
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text)',
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};
