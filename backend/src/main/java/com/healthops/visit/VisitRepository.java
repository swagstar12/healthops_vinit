package com.healthops.visit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VisitRepository extends JpaRepository<Visit, Long> {
    List<Visit> findByPatientIdOrderByVisitAtDesc(Long patientId);
    List<Visit> findByDoctorIdOrderByVisitAtDesc(Long doctorId);

    long countByPatientId(Long patientId);
    long countByDoctorId(Long doctorId);

    // ✅ Native query to count today's visits for a doctor
    @Query(
        value = "SELECT COUNT(*) FROM visits v " +
                "WHERE v.doctor_id = :doctorId " +
                "AND DATE(v.visit_at) = CURRENT_DATE",
        nativeQuery = true
    )
    long countTodayVisitsByDoctor(@Param("doctorId") Long doctorId);
}
