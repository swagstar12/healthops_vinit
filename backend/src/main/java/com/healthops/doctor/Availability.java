package com.healthops.doctor;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="availability")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Availability {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne @JoinColumn(name="doctor_id")
  @JsonIgnoreProperties({"user", "specialization", "phone"})
  private Doctor doctor;

  private int dayOfWeek;
  private java.time.LocalTime startTime;
  private java.time.LocalTime endTime;
}