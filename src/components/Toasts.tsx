import { useCallback, useState } from "react";

export interface ToastMsg {
  id: number;
  texto: string;
  tono: "ok" | "error";
}

export function useToasts() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const push = useCallback((texto: string, tono: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, texto, tono }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  return { items, push };
}

export function ToastHost({ items }: { items: ToastMsg[] }) {
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg shadow-lg px-4 py-2.5 text-sm animate-modal-in text-white ${
            t.tono === "ok" ? "bg-parroquia-900" : "bg-red-700"
          }`}
        >
          {t.texto}
        </div>
      ))}
    </div>
  );
}
