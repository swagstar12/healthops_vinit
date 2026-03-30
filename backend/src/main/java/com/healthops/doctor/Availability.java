package com.healthops.doctor;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="availability")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Availability {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne @JoinColumn(name="doctor_id")
  private Doctor doctor;

  // 1 = Monday ... 7 = Sunday
  private int dayOfWeek;

  private java.time.LocalTime startTime;
  private java.time.LocalTime endTime;
}
