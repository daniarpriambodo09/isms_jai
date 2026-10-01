-- Adds an effective date field to Working Standard documents.
ALTER TABLE working_standard_documents
  ADD COLUMN IF NOT EXISTS effective_date date;
