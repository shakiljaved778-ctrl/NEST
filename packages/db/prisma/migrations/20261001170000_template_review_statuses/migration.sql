-- Console approval workflow (Phase 7): product submits (in_review) -> compliance approves
-- (approved; Islamic copy: compliance_approved) -> Sharia reviewer approves (sharia_approved).
-- Only approved / sharia_approved templates are ever served (non-negotiable 8).
ALTER TYPE "TemplateStatus" ADD VALUE 'in_review' AFTER 'draft';
ALTER TYPE "TemplateStatus" ADD VALUE 'compliance_approved' AFTER 'in_review';
