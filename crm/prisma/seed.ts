/* Seed script: creates org structure, products, pipelines, routing rules,
 * KYC checklist, ~200 leads, ~40 accounts, ~80 contacts, ~60 deals,
 * ~30 subscriptions, tasks & activities, and prints one login per role. */
import { PrismaClient, LeadStatus, ClientStatus, DealStatus, TaskPriority, ActivityType } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { encryptField, last3 } from "../lib/crypto";

const db = new PrismaClient();

// Deterministic RNG so seeds are reproducible
let seedState = 42;
function rnd(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function int(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function daysAhead(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

const TERRITORIES = ["Doha North", "Doha South", "Al Rayyan", "Al Wakrah"];
const FIRST = ["Ahmed", "Fatima", "Mohammed", "Aisha", "Khalid", "Noora", "Hassan", "Maryam", "Omar", "Layla", "Yousef", "Sara", "Ali", "Hessa", "Ibrahim", "Dana", "Tariq", "Reem", "Faisal", "Lina", "James", "Priya", "Chen", "Elena", "Rajesh", "Anna"];
const LAST = ["Al-Thani", "Al-Kuwari", "Al-Sulaiti", "Al-Marri", "Al-Naimi", "Khan", "Patel", "Smith", "Kumar", "Hussain", "Rahman", "Sheikh", "Malik", "Ahmed", "Iqbal", "Fernandes", "George", "Mathew"];
const COMPANIES = ["Qatar National Trading", "Doha Digital Payments", "Gulf Exchange House", "Pearl Fintech Holdings", "Al Waab Investments", "Lusail Capital Partners", "West Bay Remittance", "Corniche Financial Services", "Aspire Money", "Katara Wealth", "Barwa Merchant Services", "Msheireb Pay", "Al Sadd Microfinance", "Education City Ventures", "Hamad Port Logistics Finance", "Souq Waqif Traders", "The Pearl Exchange", "Ras Laffan Treasury", "Wakra Coastal Bank Agents", "Rayyan Retail Pay", "Doha Islamic Micro", "Qatar SME Finance", "Falcon Credit Bureau", "Oryx Payment Gateway", "Dune Capital Tech", "Majlis Money", "Sidra Financial Cloud", "Baraha Settlements", "Karwa Fleet Finance", "Ooredoo Kiosk Payments", "Vodafone Agent Network", "QTerminals Trade Finance", "Snoonu Merchant Cash", "Talabat Vendor Finance", "Al Meera Payment Rails", "Lulu Exchange Partners", "Safari Remit", "City Center FX", "Villaggio Wallet Co", "Landmark Lending Tech"];
const INDUSTRIES = ["Payments", "Remittance", "Lending", "Insurance", "Wealth Management", "Banking Services", "Retail", "Logistics", "E-commerce"];
const SOURCES = ["web-form", "webhook", "csv-import", "referral", "event", "cold-call", "manual"];
const CHANNELS = ["organic", "paid-search", "social", "partner", "outbound", "events"];
const CAMPAIGNS = ["q3-payments-push", "ramadan-2026", "sme-lending-launch", "doha-fintech-expo", null, null];
const LOSS_REASONS = ["Price too high", "Chose competitor", "No budget", "Bad timing", "Missing feature", "No decision"];
const SIZES = ["1-10", "11-50", "51-200", "200+"];

async function main() {
  console.log("Seeding…");

  // ── Wipe (idempotent reseeding) ────────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(), db.notification.deleteMany(), db.job.deleteMany(),
    db.kycItemStatus.deleteMany(), db.kycChecklistItem.deleteMany(),
    db.documentVersion.deleteMany(), db.document.deleteMany(),
    db.task.deleteMany(), db.activity.deleteMany(),
    db.subscription.deleteMany(), db.dealStageHistory.deleteMany(),
    db.dealContact.deleteMany(), db.dealProduct.deleteMany(), db.deal.deleteMany(),
    db.lead.deleteMany(), db.contact.deleteMany(), db.account.deleteMany(),
    db.stage.deleteMany(), db.pipeline.deleteMany(),
    db.leadRoutingRule.deleteMany(), db.captureToken.deleteMany(),
    db.savedView.deleteMany(), db.customFieldDefinition.deleteMany(),
    db.subscription.deleteMany(), db.product.deleteMany(),
    db.appSetting.deleteMany(),
    db.user.deleteMany(), db.team.deleteMany(),
  ]);

  // ── Users & teams ──────────────────────────────────────────────────────────
  const password = "Passw0rd!Demo";
  const hash = await bcrypt.hash(password, 10);

  const admin = await db.user.create({
    data: { email: "admin@crm.qa", name: "Amal Administrator", role: "ADMIN", passwordHash: hash, territory: "Doha North" },
  });
  const managers = await Promise.all(
    [1, 2].map((i) =>
      db.user.create({
        data: { email: `manager${i}@crm.qa`, name: i === 1 ? "Maha Manager" : "Marwan Manager", role: "MANAGER", passwordHash: hash, quotaMonthly: 500_000 },
      })
    )
  );
  const readonly = await db.user.create({
    data: { email: "compliance@crm.qa", name: "Noor Compliance", role: "READ_ONLY", passwordHash: hash },
  });

  const teams: { id: string }[] = [];
  const teamLeads: { id: string; email: string }[] = [];
  const reps: { id: string; email: string; teamId: string; territory: string }[] = [];
  const productLines = ["Payments", "Lending", "Wealth", "Payments"];

  for (let t = 0; t < 4; t++) {
    const territory = TERRITORIES[t];
    const team = await db.team.create({
      data: { name: `Team ${territory}`, territory, productLine: productLines[t] },
    });
    const lead = await db.user.create({
      data: { email: `teamlead${t + 1}@crm.qa`, name: `${FIRST[t]} ${LAST[t]} (TL)`, role: "TEAM_LEAD", passwordHash: hash, teamId: team.id, territory, quotaMonthly: 250_000 },
    });
    await db.team.update({ where: { id: team.id }, data: { teamLeadId: lead.id } });
    teamLeads.push({ id: lead.id, email: lead.email });
    for (let r = 0; r < 3; r++) {
      const rep = await db.user.create({
        data: {
          email: `rep${t * 3 + r + 1}@crm.qa`,
          name: `${FIRST[4 + t * 3 + r]} ${LAST[(t * 3 + r) % LAST.length]}`,
          role: "REP",
          passwordHash: hash,
          teamId: team.id,
          territory,
          quotaMonthly: 100_000,
        },
      });
      reps.push({ id: rep.id, email: rep.email, teamId: team.id, territory });
    }
    teams.push({ id: team.id });
  }

  // ── Products ───────────────────────────────────────────────────────────────
  const products = await Promise.all(
    [
      { name: "PayCore Gateway", pricingModel: "MONTHLY" as const, price: 4500, description: "Payment gateway platform" },
      { name: "RemitFlow", pricingModel: "MONTHLY" as const, price: 3200, description: "Cross-border remittance suite" },
      { name: "LendOS", pricingModel: "ANNUAL" as const, price: 96_000, description: "Digital lending platform" },
      { name: "KYC Shield", pricingModel: "MONTHLY" as const, price: 1800, description: "Onboarding & KYC automation" },
      { name: "Implementation Package", pricingModel: "ONE_TIME" as const, price: 25_000, description: "Onboarding & integration services" },
    ].map((p) => db.product.create({ data: p }))
  );

  // ── Pipeline & stages ──────────────────────────────────────────────────────
  const pipeline = await db.pipeline.create({ data: { name: "Sales Pipeline", isDefault: true } });
  const stageData = [
    { name: "Qualified", sortOrder: 0, probability: 10, type: "OPEN" as const },
    { name: "Demo", sortOrder: 1, probability: 25, type: "OPEN" as const },
    { name: "Proposal", sortOrder: 2, probability: 50, type: "OPEN" as const },
    { name: "Negotiation", sortOrder: 3, probability: 75, type: "OPEN" as const },
    { name: "Closed Won", sortOrder: 4, probability: 100, type: "WON" as const },
    { name: "Closed Lost", sortOrder: 5, probability: 0, type: "LOST" as const },
  ];
  const stages = await Promise.all(
    stageData.map((s) => db.stage.create({ data: { ...s, pipelineId: pipeline.id } }))
  );
  const openStages = stages.filter((s) => s.type === "OPEN");
  const wonStage = stages.find((s) => s.type === "WON")!;
  const lostStage = stages.find((s) => s.type === "LOST")!;

  // ── Settings, KYC checklist, capture tokens, routing rules ────────────────
  await db.appSetting.create({
    data: { key: "sla", value: { firstTouchMinutes: 30, escalateAfterMinutes: 60, reassignOnEscalate: false } },
  });

  await Promise.all(
    [
      { name: "CR copy (trade license)", appliesTo: "ACCOUNT" as const, sortOrder: 0 },
      { name: "QID / passport copy", appliesTo: "BOTH" as const, sortOrder: 1 },
      { name: "Authorized signatory letter", appliesTo: "ACCOUNT" as const, sortOrder: 2 },
      { name: "Proof of address", appliesTo: "BOTH" as const, sortOrder: 3 },
    ].map((k) => db.kycChecklistItem.create({ data: k }))
  );

  await db.captureToken.create({ data: { token: "demo-campaign-token", kind: "FORM", campaign: "q3-payments-push", source: "web-form" } });
  await db.captureToken.create({ data: { token: "demo-webhook-token", kind: "WEBHOOK", campaign: null, source: "webhook" } });

  await db.leadRoutingRule.create({
    data: { name: "High score → Manager review team", priority: 0, criteria: { minScore: 80 }, targetType: "TEAM_ROUND_ROBIN", targetTeamId: teams[0].id },
  });
  for (let t = 0; t < 4; t++) {
    await db.leadRoutingRule.create({
      data: { name: `Territory ${TERRITORIES[t]} → Team ${t + 1}`, priority: t + 1, criteria: { territories: [TERRITORIES[t]] }, targetType: "TEAM_ROUND_ROBIN", targetTeamId: teams[t].id },
    });
  }
  await db.leadRoutingRule.create({
    data: { name: "Fallback — round robin Team 1", priority: 99, isFallback: true, criteria: {}, targetType: "TEAM_ROUND_ROBIN", targetTeamId: teams[0].id },
  });

  // ── Accounts + contacts ────────────────────────────────────────────────────
  const accounts: { id: string; ownerId: string; territory: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const owner = pick(reps);
    const acc = await db.account.create({
      data: {
        legalName: COMPANIES[i],
        crNumber: `CR-${100000 + i * 7}`,
        industry: pick(INDUSTRIES),
        size: pick(SIZES),
        website: `https://www.${COMPANIES[i].toLowerCase().replace(/[^a-z]+/g, "")}.qa`,
        address: `${int(1, 90)} Zone ${int(1, 90)}, Street ${int(100, 999)}`,
        city: "Doha",
        territory: owner.territory,
        status: rnd() < 0.55 ? ClientStatus.ACTIVE : rnd() < 0.8 ? ClientStatus.PROSPECT : ClientStatus.CHURNED,
        ownerId: owner.id,
        createdAt: daysAgo(int(30, 400)),
      },
    });
    accounts.push({ id: acc.id, ownerId: owner.id, territory: owner.territory });
  }

  const contacts: { id: string; accountId: string | null; ownerId: string }[] = [];
  for (let i = 0; i < 80; i++) {
    const isB2C = i >= 60; // 20 standalone B2C individual clients
    const account = isB2C ? null : accounts[i % accounts.length];
    const owner = account ? account.ownerId : pick(reps).id;
    const fn = pick(FIRST);
    const ln = pick(LAST);
    const qid = `2${int(70, 99)}35${String(100000 + i * 13).slice(0, 6)}`;
    const c = await db.contact.create({
      data: {
        firstName: fn,
        lastName: ln,
        accountId: account?.id ?? null,
        clientStatus: isB2C ? (rnd() < 0.7 ? ClientStatus.ACTIVE : ClientStatus.PROSPECT) : null,
        position: isB2C ? null : pick(["CEO", "CFO", "Head of Payments", "Operations Manager", "CTO", "Finance Director"]),
        email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, "")}${i}@example.qa`,
        phone: `+974 ${int(3000, 7999)} ${int(1000, 9999)}`,
        idDocType: "QID",
        nationalIdEnc: encryptField(qid),
        nationalIdLast3: last3(qid),
        nationality: pick(["Qatari", "Indian", "Egyptian", "Filipino", "British", "Pakistani", "Jordanian"]),
        preferredLanguage: rnd() < 0.4 ? "AR" : "EN",
        ownerId: owner,
        lawfulBasis: rnd() < 0.8 ? "CONSENT" : "CONTRACT",
        consentAt: daysAgo(int(10, 300)),
        createdAt: daysAgo(int(10, 350)),
      },
    });
    contacts.push({ id: c.id, accountId: account?.id ?? null, ownerId: owner });
  }

  // ── Leads (~200) ───────────────────────────────────────────────────────────
  const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"];
  const statusWeights = [0.25, 0.3, 0.2, 0.15, 0.1];
  for (let i = 0; i < 200; i++) {
    const r = rnd();
    let acc = 0;
    let status: LeadStatus = "NEW";
    for (let s = 0; s < leadStatuses.length; s++) {
      acc += statusWeights[s];
      if (r < acc) {
        status = leadStatuses[s];
        break;
      }
    }
    const rep = pick(reps);
    const createdAt = daysAgo(int(0, 120));
    const isNew = status === "NEW";
    const touched = !isNew;
    const slaMinutes = 30;
    const slaDueAt = new Date(createdAt.getTime() + slaMinutes * 60_000);
    const fn = pick(FIRST);
    const ln = pick(LAST);
    await db.lead.create({
      data: {
        firstName: fn,
        lastName: ln,
        company: rnd() < 0.7 ? `${pick(COMPANIES).split(" ").slice(0, 2).join(" ")} ${pick(["LLC", "WLL", "Trading", "Group"])}` : null,
        email: `${fn.toLowerCase()}${i}@lead-example.qa`,
        phone: `+974 ${int(3000, 7999)} ${int(1000, 9999)}`,
        source: pick(SOURCES),
        channel: pick(CHANNELS),
        campaign: pick(CAMPAIGNS),
        territory: rep.territory,
        productInterestId: pick(products).id,
        status,
        score: int(5, 98),
        ownerId: rep.id,
        teamId: rep.teamId,
        slaDueAt,
        firstTouchAt: touched ? new Date(createdAt.getTime() + int(5, 240) * 60_000) : null,
        slaBreachedAt: touched && rnd() < 0.25 ? new Date(slaDueAt.getTime() + 60_000) : null,
        disqualifyReason: status === "DISQUALIFIED" ? pick(["Not a fit", "No budget", "Unresponsive", "Duplicate"]) : null,
        lawfulBasis: "CONSENT",
        consentAt: createdAt,
        convertedAt: status === "CONVERTED" ? new Date(createdAt.getTime() + int(2, 20) * 86_400_000) : null,
        createdAt,
      },
    });
  }

  // ── Deals (~60) ────────────────────────────────────────────────────────────
  const deals: { id: string; ownerId: string; accountId: string; status: DealStatus }[] = [];
  for (let i = 0; i < 60; i++) {
    const account = accounts[i % accounts.length];
    const owner = reps.find((r) => r.id === account.ownerId) ?? pick(reps);
    const r = rnd();
    const status: DealStatus = r < 0.55 ? "OPEN" : r < 0.85 ? "WON" : "LOST";
    const stage = status === "OPEN" ? pick(openStages) : status === "WON" ? wonStage : lostStage;
    const product = pick(products);
    const qty = int(1, 3);
    const value = product.price * qty * (product.pricingModel === "MONTHLY" ? 12 : 1);
    const createdAt = daysAgo(int(5, 180));
    const contact = contacts.find((c) => c.accountId === account.id);
    const deal = await db.deal.create({
      data: {
        name: `${COMPANIES[i % COMPANIES.length].split(" ").slice(0, 2).join(" ")} — ${product.name}`,
        pipelineId: pipeline.id,
        stageId: stage.id,
        status,
        value,
        currency: "QAR",
        expectedCloseAt: status === "OPEN" ? daysAhead(int(5, 90)) : new Date(createdAt.getTime() + int(10, 60) * 86_400_000),
        ownerId: owner.id,
        teamId: owner.teamId,
        accountId: account.id,
        primaryContactId: contact?.id ?? null,
        wonAt: status === "WON" ? new Date(createdAt.getTime() + int(10, 60) * 86_400_000) : null,
        lostAt: status === "LOST" ? new Date(createdAt.getTime() + int(10, 60) * 86_400_000) : null,
        lossReason: status === "LOST" ? pick(LOSS_REASONS) : null,
        createdAt,
        products: { create: [{ productId: product.id, quantity: qty, unitPrice: product.price }] },
        ...(contact ? { contacts: { create: [{ contactId: contact.id, role: "Decision maker" }] } } : {}),
      },
    });
    // stage history
    const path = stages.filter((s) => s.sortOrder <= stage.sortOrder && (s.type === "OPEN" || s.id === stage.id));
    let prev: string | null = null;
    let when = createdAt.getTime();
    for (const st of path) {
      await db.dealStageHistory.create({
        data: { dealId: deal.id, fromStageId: prev, toStageId: st.id, changedById: owner.id, createdAt: new Date(when) },
      });
      prev = st.id;
      when += int(2, 12) * 86_400_000;
    }
    deals.push({ id: deal.id, ownerId: owner.id, accountId: account.id, status });
  }

  // ── Subscriptions (~30, staggered renewals) ───────────────────────────────
  const wonDeals = deals.filter((d) => d.status === "WON");
  for (let i = 0; i < 30; i++) {
    const deal = wonDeals[i % wonDeals.length];
    const product = pick(products.filter((p) => p.pricingModel !== "ONE_TIME"));
    const start = daysAgo(int(30, 330));
    const renewal = daysAhead([3, 5, 6, 12, 20, 25, 28, 45, 55, 58, 65, 80, 100, 150][i % 14]);
    await db.subscription.create({
      data: {
        accountId: deal.accountId,
        productId: product.id,
        dealId: deal.id,
        startDate: start,
        renewalDate: renewal,
        status: i % 9 === 8 ? "CANCELLED" : "ACTIVE",
        mrrValue: product.pricingModel === "MONTHLY" ? product.price : Math.round(product.price / 12),
      },
    });
  }
  // a few B2C subscriptions
  for (let i = 0; i < 5; i++) {
    const c = contacts[60 + i];
    await db.subscription.create({
      data: {
        contactId: c.id,
        productId: products[3].id,
        startDate: daysAgo(int(20, 200)),
        renewalDate: daysAhead(int(5, 90)),
        status: "ACTIVE",
        mrrValue: products[3].price,
      },
    });
  }

  // ── Activities & tasks ─────────────────────────────────────────────────────
  const someLeads = await db.lead.findMany({ take: 120, select: { id: true, ownerId: true } });
  const types: ActivityType[] = ["CALL", "NOTE", "MEETING", "EMAIL"];
  for (const l of someLeads) {
    const n = int(1, 3);
    for (let i = 0; i < n; i++) {
      await db.activity.create({
        data: {
          type: pick(types),
          subject: pick(["Intro call", "Follow-up", "Sent pricing", "Discovery notes", "Left voicemail", "Demo scheduled"]),
          body: "Auto-seeded activity.",
          occurredAt: daysAgo(int(0, 60)),
          userId: l.ownerId ?? admin.id,
          leadId: l.id,
        },
      });
    }
  }
  for (const d of deals.slice(0, 40)) {
    await db.activity.create({
      data: {
        type: pick(types),
        subject: pick(["Demo delivered", "Proposal sent", "Negotiation call", "Contract review"]),
        occurredAt: daysAgo(int(0, 45)),
        userId: d.ownerId,
        dealId: d.id,
      },
    });
  }

  const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  for (const rep of reps) {
    for (let i = 0; i < 6; i++) {
      const overdue = i < 2;
      await db.task.create({
        data: {
          title: pick(["Call back", "Send proposal", "Chase KYC docs", "Prepare demo", "Renewal check-in", "Update forecast"]),
          dueAt: overdue ? daysAgo(int(1, 5)) : daysAhead(int(0, 7)),
          priority: pick(priorities),
          ownerId: rep.id,
          createdById: rep.id,
          status: i === 5 ? "DONE" : "OPEN",
          completedAt: i === 5 ? daysAgo(1) : null,
        },
      });
    }
  }

  // ── FTS indexes ────────────────────────────────────────────────────────────
  const ftsSql = fs.readFileSync(path.join(__dirname, "..", "scripts", "fts.sql"), "utf8");
  for (const stmt of ftsSql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.$executeRawUnsafe(stmt);
  }

  console.log(`
──────────────────────────────────────────────────
Seed complete. Login credentials (password for all: ${password})

  Admin:      admin@crm.qa
  Manager:    manager1@crm.qa
  Team Lead:  teamlead1@crm.qa
  Sales Rep:  rep1@crm.qa
  Read-only:  compliance@crm.qa
──────────────────────────────────────────────────
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
