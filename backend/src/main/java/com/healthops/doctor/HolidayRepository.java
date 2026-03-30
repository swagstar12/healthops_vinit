package com.healthops.doctor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {
  List<Holiday> findByDoctorId(Long doctorId);
  boolean existsByDoctorIdAndDate(Long doctorId, LocalDate date);
  
  @Query("SELECT COUNT(h) FROM Holiday h WHERE h.doctor.id = :doctorId AND h.date >= CURRENT_DATE")
  long countUpcomingByDoctorId(@Param("doctorId") Long doctorId);
}