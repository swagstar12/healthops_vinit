package com.healthops.appointment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.healthops.doctor.Doctor;
import com.healthops.patient.Patient;
import com.healthops.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity @Table(name="appointments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Appointment {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne @JoinColumn(name="patient_id")
  @JsonIgnoreProperties({"dob", "address"})
  private Patient patient;

  @ManyToOne @JoinColumn(name="doctor_id")
  @JsonIgnoreProperties({"user", "specialization", "phone"})
  private Doctor doctor;

  private Instant scheduledAt;
  private String status;

  // FIXED: Removed @Lob — causes PostgreSQL "Large Objects in auto-commit mode" error
  @Column(columnDefinition = "text")
  private String reason;

  @ManyToOne @JoinColumn(name="created_by")
  @JsonIgnoreProperties({"password", "createdAt", "roles", "enabled"})
  private User createdBy;
}
