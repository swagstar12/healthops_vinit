-- Users & roles
CREATE TABLE roles(
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) UNIQUE NOT NULL
);

CREATE TABLE users(
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles(
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);

-- Doctors & availability
CREATE TABLE doctors(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization VARCHAR(255),
  phone VARCHAR(50)
);

CREATE TABLE availability(
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 1=Mon ... 7=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE holidays(
  id BIGSERIAL PRIMARY KEY,
  doctor_id BIGINT REFERENCES doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT
);

-- Patients, appointments, visits
CREATE TABLE patients(
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  dob DATE,
  phone VARCHAR(50),
  address TEXT
);

CREATE TABLE appointments(
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id BIGINT REFERENCES doctors(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  reason TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE visits(
  id BIGSERIAL PRIMARY KEY,
  patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id BIGINT REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  visit_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  diagnosis TEXT,
  prescription TEXT
);

-- Simple audit
CREATE TABLE audit_logs(
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(128) NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed roles
INSERT INTO roles(name) VALUES ('ADMIN'),('DOCTOR'),('RECEPTIONIST');
