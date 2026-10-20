import { Notice } from "@/components/ui";

/** Henüz onaylanmamış, gösterim amaçlı bölümlerin üstünde çıkan uyarı bandı. */
export function DemoNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <Notice tone="warning">
        <strong className="font-semibold">Demo sürüm:</strong>{" "}
        {children ?? "Bu bölüm henüz onay aşamasındadır; gösterim amaçlıdır, çalışma şekli değişebilir. Buradaki kayıtlar test verisidir."}
      </Notice>
    </div>
  );
}
