package com.healthops.bootstrap;

import com.healthops.doctor.Doctor;
import com.healthops.doctor.DoctorRepository;
import com.healthops.user.RoleEntity;
import com.healthops.user.RoleRepository;
import com.healthops.user.User;
import com.healthops.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class DataLoader implements CommandLineRunner {

  private final UserRepository userRepo;
  private final RoleRepository roleRepo;
  private final DoctorRepository doctorRepo;
  

  public DataLoader(UserRepository userRepo, RoleRepository roleRepo, DoctorRepository doctorRepo) {
    this.userRepo = userRepo; this.roleRepo = roleRepo; this.doctorRepo = doctorRepo;
  }

  @Override
public void run(String... args) {
    User admin = createIfMissing("admin@healthops.com", "Admin User", "Admin@123", "ADMIN");
    User doctor = createIfMissing("doc1@healthops.com", "Dr. Smith", "Doctor@123", "DOCTOR");
    User reception = createIfMissing("reception@healthops.com", "Reception One", "Reception@123", "RECEPTIONIST");

    // ensure doctor profile
    if (doctor != null && doctorRepo.findByUser(doctor).isEmpty()) {
        Doctor doc = Doctor.builder()
                .user(doctor)
                .specialization("General Medicine")
                .phone("9999999999")
                .build();
        doctorRepo.save(doc);
    }
}


  private User createIfMissing(String email, String name, String rawPass, String roleName) {
    return userRepo.findByEmail(email).orElseGet(() -> {
        var role = roleRepo.findByName(roleName).orElseGet(() -> {
            var r = new RoleEntity();
            r.setName(roleName);
            return roleRepo.save(r);
        });
        User u = new User();
        u.setEmail(email);
        u.setFullName(name);
        u.setPassword(rawPass); // plain password as per your setup
        u.setEnabled(true);
        u.setRoles(Set.of(role));
        return userRepo.save(u);
    });
  }

}
