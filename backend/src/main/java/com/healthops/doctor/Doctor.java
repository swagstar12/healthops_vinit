package com.healthops.doctor;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.healthops.user.User;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name="doctors")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Doctor {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @OneToOne
  @JoinColumn(name="user_id", unique=true)
  @JsonIgnoreProperties({"password", "createdAt", "roles"})
  private User user;

  private String specialization;
  private String phone;
}