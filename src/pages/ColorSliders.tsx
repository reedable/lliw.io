import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Popover, Range } from "framework7-react";
import { ColorChannelInput } from "./ColorChannelInput";
import {
  channelDigits,
  colorChannels,
  formatChannels,
  significant,
  sliderPosition,
  sliderChannel,
  SLIDER_TICKS,
} from "../utils/colorEditing";
import type { ColorModel } from "../utils/colorEditing";
import styles from "./ColorSliders.module.css";

export const ColorSliders = ({
  value,
  onChange,
  model,
}: {
  value: string;
  onChange: (value: string) => void;
  model: ColorModel;
}) => {
  const id = useId();
  const [opened, setOpened] = useState(false);
  const channels = colorChannels(value, model);
  const labels =
    model === "rgb"
      ? ["Red", "Green", "Blue", "Alpha"]
      : model === "hsl"
        ? ["Hue", "Saturation", "Lightness", "Alpha"]
        : ["Lightness", "Chroma", "Hue", "Alpha"];
  const maximums =
    model === "rgb"
      ? [255, 255, 255, 1]
      : model === "hsl"
        ? [360, 100, 100, 1]
        : [1, Math.max(0.4, Math.ceil(channels[1] * 10) / 10), 360, 1];
  const units =
    model === "rgb"
      ? ["", "", "", ""]
      : model === "hsl"
        ? ["°", "%", "%", " "]
        : [" ", " ", "°", " "];
  const change = (index: number, next: number) => {
    const updated = [...channels];
    updated[index] = next;
    onChange(formatChannels(updated, model));
  };
  const gradients = maximums.map((max, index) => {
    const stops = Array.from({ length: 13 }, (_, stop) => {
      const sample = [...channels];
      sample[3] = 1;
      sample[index] = (max * stop) / 12;
      return formatChannels(sample, model);
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  });
  return (
    <>
      <label className="item-title item-label" htmlFor={id}>
        {model === "oklch" ? "OKLCH" : `${model.toUpperCase()}A`}
      </label>
      <div className="item-input-wrap">
        <input
          id={id}
          type="text"
          readOnly
          value={formatChannels(channels, model)}
          aria-haspopup="dialog"
          aria-expanded={opened}
          onClick={() => setOpened(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpened(true);
            }
          }}
        />
      </div>
      <Popover
        opened={opened}
        targetEl={`[id="${id}"]`}
        className="color-picker-popover"
        closeByOutsideClick
        closeOnEscape
        onPopoverClosed={() => setOpened(false)}
      >
        <div className="color-picker">
          <div className={`color-picker-module ${styles.module}`}>
            {labels.map((label, index) => {
              const digits = channelDigits(model, index);
              const position = sliderPosition(channels[index], maximums[index]);
              return (
                <div className="color-picker-slider-wrap" key={label}>
                  <label
                    className="color-picker-slider-label"
                    htmlFor={`${id}-${index}`}
                    title={label}
                  >
                    {label[0]}
                  </label>
                  <Range
                    className={`color-picker-slider ${styles.slider} ${index === 3 ? styles.alpha : ""}`}
                    style={
                      {
                        "--channel-gradient": gradients[index],
                        "--f7-range-knob-color":
                          index === 3
                            ? "#fff"
                            : formatChannels([...channels.slice(0, 3), 1], model),
                      } as CSSProperties
                    }
                    limitKnobPosition
                    min={0}
                    max={SLIDER_TICKS}
                    step={1}
                    value={position}
                    onRangeChange={(next: number) => {
                      if (next !== position)
                        change(index, sliderChannel(next, maximums[index], digits));
                    }}
                  >
                    <input
                      type="range"
                      id={`${id}-${index}`}
                      min={0}
                      max={SLIDER_TICKS}
                      step={1}
                      defaultValue={position}
                    />
                  </Range>
                  <ColorChannelInput
                    label={label}
                    unit={units[index]}
                    displayValue={significant(channels[index], digits)}
                    digits={digits}
                    max={model === "oklch" && index === 1 ? undefined : maximums[index]}
                    onChange={(next) => change(index, next)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Popover>
    </>
  );
};
