# Dálniční známka ČR — Implementační plán

## Co se postaví

Nová sekce „Dálniční známky" v aplikaci AutoÚčtenky — evidujete platnost známek, dostanete email před expirací a máte přímý odkaz na nákup na eDalnice.cz.

## Co bude fungovat

- **Přidání známky** — typ (1denní / 10denní / 30denní / 365denní), datum nákupu, automatický výpočet konce platnosti
- **Zobrazení** ve dvou místech:
  - Karta vozidla (dashboard) — barevný badge se zbývajícími dny
  - Detail vozidla (záložka Vozidlo) — plná sekce se všemi známkami
- **Kopírování SPZ** jedním kliknutím přímo do eDalnice.cz formuláře
- **Email upozornění** 30, 14, 7 a 0 dní před expirací (přes existující systém notifikací)
- **Architektura pro více zemí** — připraveno na SK, AT, DE apod.

## Implementační kroky

1. **Datový model** — nová tabulka `vignettes` v Convex databázi
2. **Backend CRUD** — nový soubor `convex/vignettes.ts` (přidat, smazat, zobrazit)
3. **Plánovač notifikací** — rozšíření existujícího denního CRONu o kontrolu vignettes
4. **UI: VignetteSection** — nová komponenta pro detail vozidla (formulář + seznam)
5. **UI: Dashboard badge** — přidání expirujících známek do sekce „Úkoly k řešení"
6. **Nasazení** — deploy Convex + ověření TypeScript

## Co se NEDĚLÁ (no-gos)

- **Žádná separátní in-app notifikační kolekce** — bannery se zobrazují přímo z dat vignettes (jsou reaktivní přes `useQuery`), nevytvářím novou tabulku `notifications`
- **Žádný samostatný `NotificationBanner` v AppShell** — expirující známky se zobrazí v existující sekci „Úkoly k řešení" na dashboardu (konzistentní UX)
- **Žádné mazání** pro řidiče — smazat může jen vlastník

## Technické detaily

| Soubor | Změna |
|---|---|
| `convex/schema.ts` | Nová tabulka `vignettes`, rozšíření `sentNotifications.type` |
| `convex/vignettes.ts` | Nový — CRUD queries + mutations |
| `convex/notificationHelpers.ts` | Přidat `getVehicleVignettes` internal query |
| `convex/notifications.ts` | Rozšíření scheduleru o kontrolu vignettes |
| `components/vehicle-vignette-section.tsx` | Nový — plná UI sekce |
| `components/vehicle-settings-content.tsx` | Přidat VignetteSection |
| `components/dashboard-content.tsx` | Přidat vignette badge do úkolů |

## Checklist

- [ ] Schema + Convex deploy
- [ ] CRUD backend (vignettes.ts)
- [ ] Notifikační scheduler
- [ ] VignetteSection komponenta
- [ ] Dashboard badge
- [ ] Lint check + TS errors
