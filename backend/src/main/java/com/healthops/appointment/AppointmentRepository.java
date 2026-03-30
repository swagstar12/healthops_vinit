package com.healthops.appointment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByDoctorId(Long doctorId);
    List<Appointment> findByPatientId(Long patientId);

    long countByDoctorId(Long doctorId);
    long countByStatus(String status);

    // ✅ Fixed: Native SQL for PostgreSQL DATE() function
    @Query(
        value = "SELECT COUNT(*) FROM appointments a WHERE DATE(a.scheduled_at) = CURRENT_DATE",
        nativeQuery = true
    )
    long countTodayAppointments();

    // ✅ Fixed: Use native query with ILIKE for case-insensitive search in PostgreSQL
    @Query(
        value = "SELECT * FROM appointments a " +
                "JOIN patients p ON a.patient_id = p.id " +
                "WHERE p.full_name ILIKE %:query% OR p.code ILIKE %:query%",
        nativeQuery = true
    )
    List<Appointment> searchByPatientNameOrCode(@Param("query") String query);
}
