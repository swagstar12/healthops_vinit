-- Add consultation fee to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 500.00;
