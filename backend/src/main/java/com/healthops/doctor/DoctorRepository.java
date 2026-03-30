package com.healthops.doctor;

import com.healthops.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {
  Optional<Doctor> findByUser(User user);
  
  @Query("SELECT d FROM Doctor d WHERE d.user.email = :email")
  Optional<Doctor> findByUserEmail(@Param("email") String email);
}