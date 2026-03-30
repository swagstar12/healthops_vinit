package com.healthops.doctor;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity @Table(name="holidays")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Holiday {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne @JoinColumn(name="doctor_id")
  private Doctor doctor;

  private LocalDate date;
  private String reason;
}
