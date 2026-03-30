package com.healthops.visit;

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
  private Patient patient;

  @ManyToOne @JoinColumn(name="doctor_id")
  private Doctor doctor;

  @ManyToOne @JoinColumn(name="appointment_id")
  private Appointment appointment;

  private Instant visitAt = Instant.now();

  @Lob 
  @Column(columnDefinition = "text")
  private String notes;
  @Lob 
  @Column(columnDefinition = "text")
  private String diagnosis;
  @Lob 
  @Column(columnDefinition = "text")
  private String prescription;
}
