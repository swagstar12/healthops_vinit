package com.healthops.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, Long> {
  Optional<Patient> findByCode(String code);
  List<Patient> findByFullNameContainingIgnoreCaseOrCodeContainingIgnoreCase(String fullName, String code);
}