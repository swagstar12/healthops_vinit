package com.healthops.api;

import com.healthops.api.dto.DoctorDtos.CreateDoctorRequest;
import com.healthops.api.dto.DoctorDtos.UpdateDoctorRequest;
import com.healthops.api.dto.UserDtos.CreateUserRequest;
import com.healthops.api.dto.UserDtos.UpdateUserRequest;
import com.healthops.doctor.Doctor;
import com.healthops.doctor.DoctorRepository;
import com.healthops.user.Role;
import com.healthops.user.User;
import com.healthops.user.UserRepository;
import com.healthops.user.UserService;
import com.healthops.visit.VisitRepository;
import com.healthops.appointment.AppointmentRepository;
import com.healthops.patient.PatientRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
  private final UserService userService;
  private final DoctorRepository doctorRepo;
  private final UserRepository userRepo;
  private final VisitRepository visitRepo;
  private final AppointmentRepository appointmentRepo;
  private final PatientRepository patientRepo;

  public AdminController(UserService userService, DoctorRepository doctorRepo, 
                        UserRepository userRepo, VisitRepository visitRepo,
                        AppointmentRepository appointmentRepo, PatientRepository patientRepo) {
    this.userService = userService; 
    this.doctorRepo = doctorRepo; 
    this.userRepo = userRepo;
    this.visitRepo = visitRepo;
    this.appointmentRepo = appointmentRepo;
    this.patientRepo = patientRepo;
  }

  // Doctor Management
  @PostMapping("/doctors")
  public Doctor createDoctor(@RequestBody CreateDoctorRequest req) {
    var u = userService.register(req.email(), req.fullName(), req.password(), Role.DOCTOR);
    Doctor d = Doctor.builder().user(u).specialization(req.specialization()).phone(req.phone()).build();
    return doctorRepo.save(d);
  }

  @GetMapping("/doctors")
  public List<Doctor> listDoctors() { 
    return doctorRepo.findAll(); 
  }

  @GetMapping("/doctors/{id}")
  public ResponseEntity<Doctor> getDoctor(@PathVariable Long id) {
    return doctorRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/doctors/{id}")
  public ResponseEntity<Doctor> updateDoctor(@PathVariable Long id, @RequestBody UpdateDoctorRequest req) {
    return doctorRepo.findById(id).map(doctor -> {
      doctor.setSpecialization(req.specialization());
      doctor.setPhone(req.phone());
      if (doctor.getUser() != null) {
        doctor.getUser().setFullName(req.fullName());
        doctor.getUser().setEmail(req.email());
      }
      return ResponseEntity.ok(doctorRepo.save(doctor));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/doctors/{id}")
  public ResponseEntity<?> deleteDoctor(@PathVariable Long id) {
    if (doctorRepo.existsById(id)) {
      doctorRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Receptionist Management
  @PostMapping("/receptionists")
  public User createReceptionist(@RequestBody CreateUserRequest req) {
    return userService.register(req.email(), req.fullName(), req.password(), Role.RECEPTIONIST);
  }

  @GetMapping("/receptionists")
  public List<User> listReceptionists() {
    return userRepo.findByRolesName("RECEPTIONIST");
  }

  @GetMapping("/receptionists/{id}")
  public ResponseEntity<User> getReceptionist(@PathVariable Long id) {
    return userRepo.findById(id)
        .filter(user -> user.getRoles().stream().anyMatch(role -> "RECEPTIONIST".equals(role.getName())))
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/receptionists/{id}")
  public ResponseEntity<User> updateReceptionist(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
    return userRepo.findById(id)
        .filter(user -> user.getRoles().stream().anyMatch(role -> "RECEPTIONIST".equals(role.getName())))
        .map(user -> {
          user.setFullName(req.fullName());
          user.setEmail(req.email());
          user.setEnabled(req.enabled());
          return ResponseEntity.ok(userRepo.save(user));
        }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/receptionists/{id}")
  public ResponseEntity<?> deleteReceptionist(@PathVariable Long id) {
    if (userRepo.existsById(id)) {
      userRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Dashboard Statistics
  @GetMapping("/dashboard/stats")
  public Map<String, Object> getDashboardStats() {
    return Map.of(
        "totalDoctors", doctorRepo.count(),
        "totalReceptionists", userRepo.countByRolesName("RECEPTIONIST"),
        "totalPatients", patientRepo.count(),
        "totalAppointments", appointmentRepo.count(),
        "totalVisits", visitRepo.count(),
        "todayAppointments", appointmentRepo.countTodayAppointments(),
        "pendingAppointments", appointmentRepo.countByStatus("SCHEDULED"),
        "completedAppointments", appointmentRepo.countByStatus("COMPLETED")
    );
  }

  // User Management (All users)
  @GetMapping("/users")
  public List<User> getAllUsers() {
    return userRepo.findAll();
  }

  @PutMapping("/users/{id}/toggle-status")
  public ResponseEntity<User> toggleUserStatus(@PathVariable Long id) {
    return userRepo.findById(id).map(user -> {
      user.setEnabled(!user.isEnabled());
      return ResponseEntity.ok(userRepo.save(user));
    }).orElse(ResponseEntity.notFound().build());
  }
}