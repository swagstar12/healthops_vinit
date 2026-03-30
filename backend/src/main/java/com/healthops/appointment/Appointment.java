package com.healthops.appointment;

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
  private Patient patient;

  @ManyToOne @JoinColumn(name="doctor_id")
  private Doctor doctor;

  private Instant scheduledAt;
  private String status; // SCHEDULED, COMPLETED, CANCELLED
  @Lob
  @Column(columnDefinition = "text")
  private String reason;

  @ManyToOne @JoinColumn(name="created_by")
  private User createdBy;
}
