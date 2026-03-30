package com.healthops.patient;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

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
  @Lob
  @Column(columnDefinition = "text")
  private String address;
}
