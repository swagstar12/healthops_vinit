-- Link patients to their consulting doctor(s)
CREATE TABLE patient_doctors (
  patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id  BIGINT REFERENCES doctors(id)  ON DELETE CASCADE,
  PRIMARY KEY (patient_id, doctor_id)
);