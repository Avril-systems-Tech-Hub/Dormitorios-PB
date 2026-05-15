"use client";

import { useState } from "react";

export function WhatsappCta() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !phone) return;

    // Construir el texto tal cual el ejemplo
    const text = `Hola, estos son los datos de mi reservación en Dormitorios Plaza Basilica. \n\nNombre: ${name}\nWhatsApp: +52 ${phone}\n`;

    // Codificar para URL
    const encodedText = encodeURIComponent(text);

    // URL de WhatsApp (el número es el de tu ejemplo)
    const url = `https://api.whatsapp.com/send/?phone=527712929008&text=${encodedText}`;

    // Abrir en una nueva pestaña
    window.open(url, "_blank");
  };

  return (
    <div className="mx-auto max-w-md w-full mt-6 text-left">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="wa-name" className="block text-sm font-semibold text-mkt-ink">
            Nombre
          </label>
          <input
            id="wa-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-slate"
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div>
          <label htmlFor="wa-phone" className="block text-sm font-semibold text-mkt-ink">
            Número de WhatsApp
          </label>
          <input
            id="wa-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-mkt-border bg-white px-3 text-sm text-mkt-ink outline-none focus:border-mkt-slate"
            placeholder="Ej. +52 555 123 4567"
          />
        </div>
        <button
          type="submit"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#25D366] px-4 font-semibold text-white transition-colors hover:bg-[#1DA851]"
        >
          <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 fill-current" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          Enviar a WhatsApp
        </button>
      </form>
    </div>
  );
}
