import { beforeEach, describe, expect, it } from "vitest";
import {
  completeTraining,
  getApplication,
  reviewApplication,
  submitApplication,
  TRAINING_PASS_SCORE,
  uploadDocument,
  verificationQueue,
} from "../lib/onboarding";
import { matchProviders, PROVIDERS } from "../lib/providers";

beforeEach(() => {
  globalThis.__nestApplications = undefined;
});

function newApplication() {
  return submitApplication({
    name: "Test Applicant",
    phone: "+97455998877",
    gender: "female",
    skills: ["house-cleaning"],
    zones: ["west-bay"],
    languages: ["en", "tl"],
    yearsExperience: 5,
  });
}

describe("provider onboarding pipeline", () => {
  it("seeds the three applicants shown in the admin dashboard", () => {
    expect(verificationQueue()).toHaveLength(3);
  });

  it("collects documents before entering the review queue", () => {
    const app = newApplication();
    expect(app.status).toBe("documents_pending");
    uploadDocument(app.id, "qid");
    expect(getApplication(app.id)!.status).toBe("documents_pending"); // work permit still missing
    uploadDocument(app.id, "work_permit");
    expect(getApplication(app.id)!.status).toBe("under_review");
  });

  it("accepts passport as the identity document", () => {
    const app = newApplication();
    uploadDocument(app.id, "passport");
    uploadDocument(app.id, "work_permit");
    expect(getApplication(app.id)!.status).toBe("under_review");
  });

  it("blocks approval without required documents", () => {
    const app = newApplication();
    expect(() => reviewApplication(app.id, "approve")).toThrow(/not under review/);
  });

  it("approve → training → pass assessment → LIVE in the matching network", () => {
    const before = PROVIDERS.length;
    const app = newApplication();
    uploadDocument(app.id, "qid");
    uploadDocument(app.id, "work_permit");

    const reviewed = reviewApplication(app.id, "approve", "Docs clean");
    expect(reviewed.status).toBe("training");
    expect(reviewed.documents.every((d) => d.status === "verified")).toBe(true);

    const done = completeTraining(app.id, 0.92);
    expect(done.status).toBe("approved");
    expect(done.providerId).toBeDefined();
    expect(PROVIDERS.length).toBe(before + 1);

    // The new pro is immediately matchable in her zone/skill.
    const matches = matchProviders({ serviceId: "house-cleaning", zoneId: "west-bay" }, 20);
    expect(matches.some((m) => m.provider.id === done.providerId)).toBe(true);

    // cleanup: keep the seed network stable for other tests
    PROVIDERS.splice(PROVIDERS.findIndex((p) => p.id === done.providerId), 1);
  });

  it("keeps failed assessments in training for a retake", () => {
    const app = newApplication();
    uploadDocument(app.id, "qid");
    uploadDocument(app.id, "work_permit");
    reviewApplication(app.id, "approve");
    const failed = completeTraining(app.id, TRAINING_PASS_SCORE - 0.1);
    expect(failed.status).toBe("training");
    expect(failed.reviewNote).toMatch(/retake/);
  });

  it("supports rejection with an ops note", () => {
    const [queued] = verificationQueue();
    const rejected = reviewApplication(queued.id, "reject", "Work permit expired");
    expect(rejected.status).toBe("rejected");
    expect(rejected.reviewNote).toBe("Work permit expired");
    expect(verificationQueue()).toHaveLength(2);
  });

  it("re-upload replaces the same document type", () => {
    const app = newApplication();
    uploadDocument(app.id, "qid");
    uploadDocument(app.id, "qid");
    expect(getApplication(app.id)!.documents.filter((d) => d.type === "qid")).toHaveLength(1);
  });

  it("validates application input", () => {
    expect(() => submitApplication({ name: " ", phone: "x", gender: "male", skills: ["plumbing"], zones: ["lusail"], languages: ["en"], yearsExperience: 1 })).toThrow(/Name/);
    expect(() => submitApplication({ name: "A", phone: "x", gender: "male", skills: [], zones: ["lusail"], languages: ["en"], yearsExperience: 1 })).toThrow(/skill/);
  });
});
