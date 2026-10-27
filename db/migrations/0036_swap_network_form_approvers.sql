-- db/migrations/0036_swap_network_form_approvers.sql
-- Migration 0036: Swap approval order for ISMS-F-03-00-003 (Company Network Connection Application Form)
-- Persetujuan oleh Pak Teguh Sunjoyo (Information Assets Administrator) terlebih dahulu (Step 1),
-- kemudian IT Section / IT Security Admin melakukan pengecekan di terakhir (Step 2).

UPDATE it_form_approvers
SET slot_number = 1, sort_order = 1
WHERE form_code = 'ISMS-F-03-00-003'
  AND (slot_label ILIKE '%APPROVAL%' OR role_title ILIKE '%Information Assets Administrator%' OR person_name ILIKE '%TEGUH SUNJOYO%');

UPDATE it_form_approvers
SET slot_number = 2, sort_order = 2
WHERE form_code = 'ISMS-F-03-00-003'
  AND (slot_label ILIKE '%CHECK%' OR slot_label ILIKE '%CEK%' OR role_title ILIKE '%IT Section%' OR role_title ILIKE '%SSA%');
