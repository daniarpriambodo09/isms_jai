-- db/migrations/0024_approver_salutation.sql
--
-- How an approver is addressed in e-mails ("Dear Bapak …," / "Dear Ibu …,"):
-- 'Bapak', 'Ibu', or empty for just "Dear <name>,". Set where the approver is
-- set: the positions of Kelola Pengesahan and the Visitor approver of Ijin
-- Foto/Video. (A document's own approver and the hand-entered approver of
-- Izin Area Special keep theirs in their JSON.) Safe to re-run.

ALTER TABLE procedure_approver_roles ADD COLUMN IF NOT EXISTS salutation varchar(10);
ALTER TABLE pic_approvers ADD COLUMN IF NOT EXISTS salutation varchar(10);
