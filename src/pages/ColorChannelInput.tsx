import { useState } from "react";
import { significant } from "../utils/colorEditing";

/** Numeric entry commits on blur/Enter, like Framework7's picker value inputs. */
export const ColorChannelInput = ({
  label,
  unit,
  displayValue,
  digits,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  displayValue: number;
  digits: number;
  max?: number;
  onChange: (value: number) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="color-picker-slider-value">
      <input
        type="number"
        inputMode="decimal"
        aria-label={unit ? `${label} (${unit})` : label}
        title={unit ? `${label} (${unit})` : label}
        min={0}
        max={max}
        step="any"
        value={draft ?? displayValue}
        onFocus={() => setDraft(String(displayValue))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (
            Number.isFinite(next) &&
            next >= 0 &&
            (max === undefined || next <= max) &&
            next !== displayValue
          ) {
            onChange(significant(next, digits));
          }
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};
