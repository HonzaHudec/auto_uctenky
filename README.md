# auto_uctenky

Aplikace pro evidenci nakladu na auto (Next.js + Convex), puvodne vytvorena v Macaly/Cursor.

## Vercel ready setup

1. Vytvor `Environment Variables` ve Vercelu podle `.env.example`.
2. Minimalni povinne promenne:
   - `NEXT_PUBLIC_CONVEX_URL`
   - `CONVEX_SITE_URL` (v kodu je fallback i na `SITE_URL`)
3. Doporucene:
   - `NEXT_PUBLIC_CONVEX_SITE_URL`
   - `NEXT_PUBLIC_CONVEX_DEPLOY_NAME`
4. Volitelne (jen pokud chces funkcionalitu):
   - OCR: `MACALY_BASE_URL`, `MACALY_API_TOKEN`, `MACALY_CHAT_ID`, `MACALY_BYPASS_HEADER`
   - OTP login: `OTP_ENDPOINT`, `CHAT_ID`, `APP_NAME`, `SECRET_KEY`
   - Notifikace: `EMAIL_NOTIFICATION_ENDPOINT`, `RECIPIENT_EMAIL`
5. Po ulozeni env promennych udelej ve Vercelu `Redeploy`.

## OCR uctenky (tankovani)

- OCR endpoint je `POST /api/ocr`.
- Ocekavany request body: `imageBase64`, `mimeType`.
- Endpoint vraci pole:
  - `date` (`YYYY-MM-DD` nebo `null`)
  - `liters` (`number` nebo `null`)
  - `pricePerLiter` (`number` nebo `null`)
  - `totalAmountCzk` (`number` nebo `null`)
  - `confidence` (`high` | `medium` | `low`)
- Ve formulari pro tankovani se po OCR automaticky predvyplni:
  - datum (`date`)
  - mnozstvi (`liters`)
  - cena za litr/kWh (`pricePerLiter`)
- Pokud LLM nevrati validni JSON, backend pouzije fallback parsovani z raw textu.
- Pokud se OCR nepodari, aplikace umozni rucni dopsani hodnot.

## Jak to zprocesovat do GitHubu

Pokud tento adresar jeste neni git repo:

```bash
git init
git add .
git commit -m "Make project Vercel-ready and document deployment setup"
git branch -M main
git remote add origin https://github.com/<tvuj-ucet>/<tvuj-repo>.git
git push -u origin main
```

Pokud uz repo mas a jen potrebujes poslat zmeny:

```bash
git add convex/auth.config.ts .env.example README.md
git commit -m "Make project Vercel-ready and add deployment guide"
git push
```

## Napojeni na Vercel

1. Vercel -> `Add New...` -> `Project` -> vyber GitHub repo.
2. Framework nech `Next.js` (auto-detekce).
3. Zkopiruj env promenne z `.env.example` do Vercel projektu.
4. Deploy.
