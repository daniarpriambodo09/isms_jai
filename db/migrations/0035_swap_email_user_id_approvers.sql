-- db/migrations/0035_swap_email_user_id_approvers.sql
-- Migration 0035: Swap approval order for ISMS-F-010-006 (Pengajuan / Perubahan Email & User ID)
-- Request disetujui oleh Departemen Manager terlebih dahulu (Step 1), IR/HR Mengetahui (Step 2), lalu dicek oleh IT Section / IT Supervisor di terakhir (Step 3).

UPDATE it_form_approvers
SET slot_number = 1, sort_order = 1
WHERE form_code = 'ISMS-F-010-006'
  AND (slot_label ILIKE '%MENYETUJUI%' OR role_title ILIKE '%MANAGER%');

UPDATE it_form_approvers
SET slot_number = 2, sort_order = 2
WHERE form_code = 'ISMS-F-010-006'
  AND (slot_label ILIKE '%MENGETAHUI%' OR role_title ILIKE '%HR%' OR role_title ILIKE '%IR%');

UPDATE it_form_approvers
SET slot_number = 3, sort_order = 3
WHERE form_code = 'ISMS-F-010-006'
  AND (slot_label ILIKE '%CHECK%' OR slot_label ILIKE '%CEK%' OR role_title ILIKE '%IT%' OR role_title ILIKE '%SSA%');
