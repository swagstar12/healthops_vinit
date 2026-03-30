package com.healthops.user;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity @Table(name="users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable=false, unique=true)
  private String email;

  @Column(nullable=false)
  private String password;

  @Column(nullable=false)
  private String fullName;

  @Column(nullable=false)
  @Builder.Default
  private boolean enabled = true;

  @Column(nullable=false)
  @Builder.Default
  private Instant createdAt = Instant.now();

  @ManyToMany(fetch = FetchType.EAGER)
  @JoinTable(name="user_roles",
    joinColumns = @JoinColumn(name="user_id"),
    inverseJoinColumns = @JoinColumn(name="role_id"))
  @Builder.Default
  private Set<RoleEntity> roles = new HashSet<>();
}