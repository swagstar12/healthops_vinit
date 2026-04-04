package com.healthops.patient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.healthops.doctor.Doctor;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity @Table(name="patients")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Patient {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable=false, unique=true)
  private String code;

  @Column(nullable=false)
  private String fullName;

  private LocalDate dob;
  private String phone;

  @Column(columnDefinition = "text")
  private String address;

  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(
    name = "patient_doctors",
    joinColumns = @JoinColumn(name = "patient_id"),
    inverseJoinColumns = @JoinColumn(name = "doctor_id")
  )
  @JsonIgnoreProperties({"user", "specialization", "phone", "consultationFee", "doctors"})
  @Builder.Default
  private Set<Doctor> doctors = new HashSet<>();
}