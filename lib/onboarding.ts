import { PROVIDERS } from "./providers";
import type { LanguageCode, Provider, ZoneId } from "./types";

/**
 * Provider onboarding & KYC pipeline (trust is the product):
 *
 *   submit application → upload documents (QID/passport + work permit)
 *   → under_review (ops verification queue) → approve → training
 *   → pass assessment → LIVE in the matching network
 *
 * Rejections at any stage carry an ops note. Production stores documents
 * KMS-encrypted in S3 via pre-signed uploads; only metadata lives here.
 */

export type DocumentType = "qid" | "passport" | "work_permit" | "certificate";
export type DocumentStatus = "pending_review" | "verified" | "rejected";
export type ApplicationStatus = "documents_pending" | "under_review" | "training" | "approved" | "rejected";

/** QID or passport satisfies identity; work permit is always required. */
const REQUIRED: DocumentType[][] = [["qid", "passport"], ["work_permit"]];
export const TRAINING_PASS_SCORE = 0.8;

export interface ApplicationDocument {
  type: DocumentType;
  status: DocumentStatus;
  uploadedAt: string;
}

export interface ProviderApplication {
  id: string;
  name: string;
  phone: string;
  gender: "male" | "female";
  skills: string[];
  zones: ZoneId[];
  languages: LanguageCode[];
  yearsExperience: number;
  status: ApplicationStatus;
  documents: ApplicationDocument[];
  trainingScore?: number;
  reviewNote?: string;
  createdAt: string;
  /** Set when approved and added to the live network. */
  providerId?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nestApplications: ProviderApplication[] | undefined;
}

function seedApplications(): ProviderApplication[] {
  const mk = (id: string, name: string, gender: "male" | "female", skills: string[], zones: ZoneId[], languages: LanguageCode[], years: number, docs: DocumentType[]): ProviderApplication => ({
    id,
    name,
    phone: `+9745${id.slice(-6)}`,
    gender,
    skills,
    zones,
    languages,
    yearsExperience: years,
    status: "under_review",
    documents: docs.map((type) => ({ type, status: "pending_review", uploadedAt: new Date().toISOString() })),
    createdAt: new Date().toISOString(),
  });
  // The three applicants shown awaiting review in the admin dashboard.
  return [
    mk("APP-201", "Rajan Varghese", "male", ["ac-technician", "electrical"], ["al-sadd", "msheireb"], ["en", "ml"], 7, ["qid", "work_permit", "certificate"]),
    mk("APP-202", "Lourdes Mendoza", "female", ["house-cleaning", "laundry"], ["the-pearl", "lusail"], ["en", "tl"], 4, ["passport", "work_permit"]),
    mk("APP-203", "Bilal Ahmed", "male", ["plumbing", "handyman"], ["al-rayyan", "al-wakrah"], ["ur", "en"], 9, ["qid", "work_permit"]),
  ];
}

function apps(): ProviderApplication[] {
  if (!globalThis.__nestApplications) globalThis.__nestApplications = seedApplications();
  return globalThis.__nestApplications;
}

export interface ApplicationInput {
  name: string;
  phone: string;
  gender: "male" | "female";
  skills: string[];
  zones: ZoneId[];
  languages: LanguageCode[];
  yearsExperience: number;
}

export function submitApplication(input: ApplicationInput): ProviderApplication {
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.skills.length) throw new Error("At least one skill is required");
  if (!input.zones.length) throw new Error("At least one zone is required");
  const app: ProviderApplication = {
    ...input,
    id: `APP-${204 + apps().length - 3}`,
    status: "documents_pending",
    documents: [],
    createdAt: new Date().toISOString(),
  };
  apps().push(app);
  return app;
}

function hasRequiredDocs(app: ProviderApplication): boolean {
  return REQUIRED.every((group) => group.some((type) => app.documents.some((d) => d.type === type && d.status !== "rejected")));
}

export function uploadDocument(applicationId: string, type: DocumentType): ProviderApplication {
  const app = getApplication(applicationId);
  if (!app) throw new Error(`Unknown application: ${applicationId}`);
  if (app.status === "approved" || app.status === "rejected") {
    throw new Error(`Cannot upload documents on a ${app.status} application`);
  }
  // Re-upload replaces the previous document of the same type.
  app.documents = app.documents.filter((d) => d.type !== type);
  app.documents.push({ type, status: "pending_review", uploadedAt: new Date().toISOString() });
  if (app.status === "documents_pending" && hasRequiredDocs(app)) app.status = "under_review";
  return app;
}

export function reviewApplication(applicationId: string, decision: "approve" | "reject", note = ""): ProviderApplication {
  const app = getApplication(applicationId);
  if (!app) throw new Error(`Unknown application: ${applicationId}`);
  if (app.status !== "under_review") throw new Error(`Application is ${app.status}, not under review`);

  if (decision === "reject") {
    app.status = "rejected";
    app.reviewNote = note || "Documents did not pass verification";
    return app;
  }

  if (!hasRequiredDocs(app)) throw new Error("Identity (QID/passport) and work permit are required before approval");
  for (const d of app.documents) d.status = "verified";
  app.status = "training";
  app.reviewNote = note;
  return app;
}

/** Assessment after the training modules; passing puts the provider LIVE. */
export function completeTraining(applicationId: string, score: number): ProviderApplication {
  const app = getApplication(applicationId);
  if (!app) throw new Error(`Unknown application: ${applicationId}`);
  if (app.status !== "training") throw new Error(`Application is ${app.status}, not in training`);
  if (score < 0 || score > 1) throw new Error("Score must be between 0 and 1");

  app.trainingScore = score;
  if (score < TRAINING_PASS_SCORE) {
    app.reviewNote = `Assessment ${Math.round(score * 100)}% — below the ${TRAINING_PASS_SCORE * 100}% pass mark, retake scheduled`;
    return app; // stays in training for a retake
  }

  const provider: Provider = {
    id: `p${PROVIDERS.length + 1}`,
    name: app.name,
    avatarInitials: app.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    gender: app.gender,
    rating: 5, // new pros start at 5.0 and earn their history
    jobsDone: 0,
    completionRate: 1,
    responseMinutes: 8,
    skills: app.skills,
    zones: app.zones,
    languages: app.languages,
    verified: true,
    yearsExperience: app.yearsExperience,
  };
  PROVIDERS.push(provider);
  app.status = "approved";
  app.providerId = provider.id;
  return app;
}

export function getApplication(id: string): ProviderApplication | undefined {
  return apps().find((a) => a.id === id);
}

export function verificationQueue(): ProviderApplication[] {
  return apps().filter((a) => a.status === "under_review" || a.status === "documents_pending");
}

export function listApplications(): ProviderApplication[] {
  return [...apps()];
}
