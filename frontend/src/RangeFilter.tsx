import { useEffect, useId, useState } from "react";
import { formatManwonInput, rangeFilterError } from "./rangeFilterTools";

interface Props {
  label: string; unit: string; limit: number; min: string; max: string;
  placeholders: [string, string]; onChange: (min: string, max: string) => void;
  onInvalid: (invalid: boolean) => void;
  presets?: ReadonlyArray<{ label: string; min: string; max: string }>;
}
export default function RangeFilter({ label, unit, limit, min, max, placeholders, onChange, onInvalid, presets = [] }: Props) {
  const [draft, setDraft] = useState([min, max]);
  const errorId = useId();
  useEffect(() => {
    setDraft([min, max]);
    onInvalid(Boolean(rangeFilterError(min, max, limit)));
  }, [min, max, limit, onInvalid]);
  const error = rangeFilterError(draft[0], draft[1], limit);
  const update = (index: number, value: string) => {
    const next = [...draft]; next[index] = value;
    setDraft(next); onInvalid(Boolean(rangeFilterError(next[0], next[1], limit)));
  };
  const commit = () => {
    if (!error && (draft[0] !== min || draft[1] !== max)) onChange(draft[0], draft[1]);
  };
  const replace = (nextMin: string, nextMax: string) => {
    setDraft([nextMin, nextMax]); onInvalid(false); onChange(nextMin, nextMax);
  };
  return <div className="range-filter">
    {presets.length > 0 && <div className="range-presets" role="group" aria-label={`${label} 빠른 선택`}>
      {presets.map(preset => <button type="button" key={preset.label}
        aria-pressed={!error && draft[0] === preset.min && draft[1] === preset.max}
        onClick={() => replace(preset.min, preset.max)}>{preset.label}</button>)}
    </div>}
    <div className="price-range">{["최소", "최대"].map((name, index) => <label key={name}>{name}
      <input type="text" inputMode="numeric" maxLength={12} value={draft[index]}
        aria-label={`${label} ${name} (${unit})`} aria-invalid={Boolean(error)} aria-describedby={errorId}
        placeholder={placeholders[index]} onChange={event => update(index, event.target.value)}
        onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
    </label>)}</div>
    {unit === "만원" && !error && (draft[0] || draft[1]) && <p className="price-help" aria-live="polite">
      입력 금액: {draft[0] ? formatManwonInput(draft[0]) : "최소 제한 없음"} ~ {draft[1] ? formatManwonInput(draft[1]) : "최대 제한 없음"}
    </p>}
    <p id={errorId} className={error ? "range-error" : "price-help"} role={error ? "alert" : undefined}>
      {error || "입력을 마치고 다른 항목을 누르거나 Enter를 누르면 반영됩니다."}
    </p>
    {(draft[0] || draft[1]) && <button type="button" className="range-clear" onClick={() => {
      replace("", "");
    }}>{label} 범위 해제</button>}
  </div>;
}

