import Image from "next/image";
import Link from "next/link";
import { WaaPProvider } from "@/components/guest/waap-provider";

export default function GuestAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <WaaPProvider>
      <div className="min-h-screen bg-surface">
        <header className="border-b border-border-soft bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo-dorm.png"
                alt="Dormitorios Plaza Basílica"
                width={40}
                height={40}
                className="rounded-md"
              />
              <span className="text-sm font-semibold text-text-main">Dormitorios Plaza Basílica</span>
            </Link>
            <Link href="/" className="text-sm font-medium text-brand-primary hover:underline">
              Inicio
            </Link>
          </div>
        </header>
        <main className="px-4 py-8">{children}</main>
      </div>
    </WaaPProvider>
  );
}
