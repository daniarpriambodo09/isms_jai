-- Migration 0033: Swap approval order for procurement requests (ISMS-F-010-001 and ISMS-F-010-003)
-- Request pengadaan disetujui oleh Manager pemohon terlebih dahulu (Step 1), baru dicek oleh IT Section (Step 2).

UPDATE it_form_approvers
SET slot_number = 1, sort_order = 1
WHERE form_code IN ('ISMS-F-010-001', 'ISMS-F-010-003')
  AND (slot_label ILIKE '%MGR%' OR role_title ILIKE '%MANAGER%');

UPDATE it_form_approvers
SET slot_number = 2, sort_order = 2
WHERE form_code IN ('ISMS-F-010-001', 'ISMS-F-010-003')
  AND (slot_label ILIKE '%IT%' OR role_title ILIKE '%IT%');
