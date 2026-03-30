package com.healthops.doctor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AvailabilityRepository extends JpaRepository<Availability, Long> {
  List<Availability> findByDoctorId(Long doctorId);
  long countByDoctorId(Long doctorId);
}