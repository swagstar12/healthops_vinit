package com.healthops.visit;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.healthops.appointment.Appointment;
import com.healthops.doctor.Doctor;
import com.healthops.patient.Patient;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity @Table(name="visits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Visit {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne @JoinColumn(name="patient_id")
  @JsonIgnoreProperties({"dob", "address"})
  private Patient patient;

  @ManyToOne @JoinColumn(name="doctor_id")
  @JsonIgnoreProperties({"user", "specialization", "phone"})
  private Doctor doctor;

  @ManyToOne @JoinColumn(name="appointment_id")
  @JsonIgnoreProperties({"patient", "doctor", "reason", "createdBy"})
  private Appointment appointment;

  private Instant visitAt = Instant.now();

  // FIXED: Removed @Lob — use columnDefinition = "text" directly without @Lob
  // @Lob with PostgreSQL causes "Large Objects may not be used in auto-commit mode"
  @Column(columnDefinition = "text")
  private String notes;

  @Column(columnDefinition = "text")
  private String diagnosis;

  @Column(columnDefinition = "text")
  private String prescription;
}
