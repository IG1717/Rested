"use client";

/** iOS segmented control. The thumb slides on a critically damped spring and retargets mid-flight. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  large,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  large?: boolean;
  label: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`segmented${large ? " large" : ""}`} role="group" aria-label={label}>
      <span
        className="segmented-thumb"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${i * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          // Commit on press-down, like UIKit, so the thumb starts moving immediately.
          onPointerDown={(e) => {
            if (e.button === 0) onChange(o.value);
          }}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
