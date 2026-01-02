// 12-hour AM/PM time picker component
export function TimePicker12h(props: {
  value: string; // "HH:MM" in 24-hour format
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  // Convert 24h to 12h
  const to12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return { hours: hours12, minutes, period };
  };

  // Convert 12h to 24h
  const to24Hour = (hours12: number, minutes: number, period: string) => {
    let hours24 = hours12;
    if (period === "AM" && hours12 === 12) hours24 = 0;
    if (period === "PM" && hours12 !== 12) hours24 = hours12 + 12;
    return `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const { hours, minutes, period } = to12Hour(props.value || "09:00");

  return (
    <div className="flex items-center gap-1">
      <select
        value={hours}
        onChange={(e) => props.onChange(to24Hour(Number(e.target.value), minutes, period))}
        disabled={props.disabled}
        className="rounded border border-black/10 px-2 py-1 text-sm"
      >
        {[...Array(12)].map((_, i) => {
          const h = i + 1;
          return <option key={h} value={h}>{h}</option>;
        })}
      </select>
      <span>:</span>
      <select
        value={minutes}
        onChange={(e) => props.onChange(to24Hour(hours, Number(e.target.value), period))}
        disabled={props.disabled}
        className="rounded border border-black/10 px-2 py-1 text-sm"
      >
        {["00", "15", "30", "45"].map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => props.onChange(to24Hour(hours, minutes, e.target.value))}
        disabled={props.disabled}
        className="rounded border border-black/10 px-2 py-1 text-sm"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
