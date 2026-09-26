# Finanzas Y&L — Hogar

App web responsive de gestión financiera del hogar para **Yamil** y **Liz**.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + Shadcn UI + Lucide
- Zustand (sesión + datos mock con persistencia local)
- Recharts (dashboard)

## Arranque

```bash
cd finanzas-hogar
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Módulos

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard: gráficos, capacidad de ahorro, alertas de vencimiento |
| `/gastos` | Gastos + cierre de cuentas (50/50 o % ingresos) |
| `/deudas` | Deudas, tabla de amortización, abono extraordinario |
| `/ingresos` | Ingresos bimoneda USD/COP con TRM |
| `/ahorros` | Metas e inversiones |
| `/perfil` | User switcher, tema, modo admin, reset mock |

## Ownership

Cada registro tiene `owner`: `Yamil` | `Liz` | `Shared`.

- Vista individual: solo editas tus ítems (Shared siempre editable).
- Vista Familiar / modo Admin: edición completa.

## TRM

Orden de fuentes: datos.gov.co → open.er-api.com → valor estático (~4100).

## Deploy (Netlify)

1. Entra a [https://app.netlify.com](https://app.netlify.com) e inicia sesión con GitHub.
2. **Add new site → Import an existing project → GitHub**.
3. Elige el repo `yamilsteven/finanzas-hogar`.
4. Netlify detecta Next.js. Confirma (o deja que use `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
5. **Deploy site**.

Cada `git push` a `master` vuelve a desplegar automáticamente.
URL típica: `https://finanzas-hogar.netlify.app` (puedes cambiar el nombre en Site settings → Domain management).
