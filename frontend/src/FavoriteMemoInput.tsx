type Props = { value: string; label: string; placeholder: string; dirty: boolean; busy: boolean; error?: string;
  onChange: (value: string) => void; onSave: (value: string) => Promise<boolean> };

export default function FavoriteMemoInput({ value, label, placeholder, dirty, busy, error, onChange, onSave }: Props) {
  return <div className="favorite-memo-field">
    <label>{label}<input value={value} maxLength={500} placeholder={placeholder}
      onChange={event => onChange(event.target.value)} onBlur={event => { if (dirty) void onSave(event.target.value); }} /></label>
    <small role={error ? "alert" : "status"}>{error ? `${error} 입력한 메모는 유지됩니다.` : busy ? "저장 중 · 계속 입력할 수 있어요" : dirty ? "저장하지 않은 메모" : "저장된 메모"}</small>
    {(dirty || error) && <button type="button" disabled={busy} onClick={() => void onSave(value)}>메모 저장</button>}
    {value && <button type="button" disabled={busy} onClick={() => { onChange(""); void onSave(""); }}>메모 삭제</button>}
  </div>;
}
