import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Campo de contraseña con botón de ojito para mostrar/ocultar. */
export default function ClaveInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={`${className ?? "mt-1 w-full border rounded px-3 py-2"} pr-10`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
