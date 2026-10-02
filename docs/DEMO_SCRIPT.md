# AMIL: 7-minute bank demo

A walkthrough for a pitch to a bank's retail, digital and compliance leads. Everything on screen
is synthetic: **Doha Demo Bank is fictional**.

## Before the meeting (5 minutes)

```bash
git clone <repo> amil-ai && cd amil-ai
docker compose up --build
```

When the logs settle, three tabs are ready:

| Tab | URL                   | Notes                                                     |
| --- | --------------------- | --------------------------------------------------------- |
| 1   | http://localhost:3000 | Doha Demo Bank. Use a narrow window: it is a phone frame. |
| 2   | http://localhost:3001 | Bank console, signed in as Compliance officer.            |
| 3   | (keep free)           | Reserve.                                                  |

The setup step seeds 25 synthetic customers, 30 days of activity for the dashboard and today's
alerts. Without Docker, run `pnpm dev` after `pnpm db:migrate && pnpm db:seed && pnpm --filter
@amil/api demo:traffic`.

Rehearse once. Re-running `docker compose up` re-seeds the products and keeps the audit history.

## The story in one line

_"Your customers make expensive decisions in your app every day without seeing what they lose.
AMIL shows them, in your app, in Arabic or English, with your numbers and your approved words,
before they confirm. Every word is approved and every figure computed; nothing moves money; it
is all provable afterwards."_

## 0:00–2:00: Khalid closes his card (tab 1)

1. Open **Switch customer (demo)** and pick **Khalid**.
2. Tap his **Platinum** card, then **Close card**.
3. The insight appears before the bank's own confirmation: **"Closing this card forfeits 42,000
   points (about QAR 420.00)"**, critical.

   Point at:
   - **Fact chips:** every figure has a source and an as-of date (rewards ledger, card). _"Nothing
     here is generated. The rules engine computed it from his own products and your rules."_
   - **Why am I seeing this?** The plain reasons.
   - **"Continue" stays disabled** until he ticks **I understand**. _"For critical cards, he has to
     acknowledge."_
   - **Options:** the first one avoids the loss. Tap **Redeem points first**. It deep-links into
     the bank's own rewards screen. _"AMIL never executes anything. It sends him back into your
     flow."_

4. Tap **العربية** in the header and close the card again. The same card appears, right to
   left, in approved Arabic copy.

## 2:00–3:30: Fatima settles her murabaha early (tab 1)

1. Switch to **Fatima**, open her **murabaha** finance, then **Settle early**.
2. **"Settling on {date} instead of today costs QAR 4,000.00 less"**: the ibra (rebate) policy
   makes a date 19 days away cheaper.

   Point at:
   - **Islamic product, Islamic terminology:** profit, ibra, never "interest". Sharia-approved
     copy only.
   - **Settle on the cheaper date** goes to the bank's scheduling screen.

3. Optional (30 seconds): open **Compare settlement dates** from her finance page. It is the same
   engine, laid out side by side.

## 3:30–6:00: The bank's view (tab 2, console)

1. **Dashboard.** Insights by pack and severity, customer responses, **reconsidered actions** and
   **estimated value protected**, plus the model safeguards (validator rejections, latency).
   _"This is the case for your board."_
2. **Complaints lookup.** Enter `DDB-C-0001` (Khalid) and select **Look up**. Every insight he
   was shown appears, in his language, with the figures, the sources, the options offered and
   what he chose, at what time. The **audit chain is verified**.
   _"When a customer says 'nobody told me', you can show exactly what they saw. The record is
   hash-chained and append-only: it cannot be edited, even by us."_
3. **Audit.**
   - Open the event from the lookup: its hash and its link to the previous event both verify.
   - Back on **Audit**, select **Verify hash chain** to check the whole log.
   - Mention **Export CSV/JSON**, and that every one of these lookups is itself recorded under
     **Console activity**.
4. **The bank stays in control** (switch user to the **Product manager**):
   - **Rule packs, then Card closure:** parameters are versioned, with a diff and an effective
     date. Change `programmePointValueQar` to `0.0125`, review, save, and close Khalid's card
     again in tab 1. It now says **QAR 525.00**. (Clear the value afterwards to return to 420.)
   - **Kill switch:** turn Card closure off. Khalid's next attempt shows only the bank's own
     Continue: no insight, no error.
   - **Templates:** copy changes go draft, then compliance, then Sharia for Islamic copy. Type
     "upgrade" into a headline: the banned-term checker flags it live.

## 6:00–7:00: Compliance pack (tab 2)

Open **Compliance pack**. It is generated from the running system:

- the model card (mode, providers, safeguards);
- the data flow;
- the exact fields each pack reads;
- **a real outbound model payload:** _"This is everything a model ever sees. No name, no account
  or card number, no free text. In `in_country` mode it never leaves your perimeter; in `off`
  mode there is no model at all."_;
- retention (10 years) and consent purposes.

Close with: _"Your data stays in-country, your rules decide, your compliance team approves every
word, and every insight is provable."_

## If something goes wrong

| Problem                         | Fix                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| The insight does not appear     | The bank's own Continue shows instead, by design. Check that the Card closure kill switch is on. |
| The console asks you to sign in | Pick the staff member again; tokens last 8 hours.                                                |
| The dashboard is empty          | Run `docker compose run --rm setup` (or `pnpm --filter @amil/api demo:traffic`).                 |
| Khalid shows QAR 525.00         | Clear `programmePointValueQar` on Card closure (conventional).                                   |
