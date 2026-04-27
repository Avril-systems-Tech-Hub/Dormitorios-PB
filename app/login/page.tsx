import Image from "next/image";
import { loginAction } from "@/actions/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm space-y-4">
        <div className="space-y-2 text-center">
          <Image
            src="/logo-dorm.png"
            alt="Dormitorios Plaza Basílica"
            width={72}
            height={72}
            className="mx-auto rounded-md"
          />
          <h1 className="text-xl font-semibold">Acceso operativo</h1>
          <p className="text-sm text-text-muted">Inicia sesión para continuar</p>
        </div>

        <form action={loginAction} className="space-y-3">
          <Input name="email" placeholder="Correo" type="email" required />
          <Input name="password" placeholder="Contraseña" type="password" required />
          {params.error ? (
            <p className="text-sm text-danger">{params.error}</p>
          ) : null}
          <Button className="w-full" type="submit">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
