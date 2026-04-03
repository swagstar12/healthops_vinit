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

import java.math.BigDecimal;
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

    // ─── Doctor Management ────────────────────────────────────────────────────

    @PostMapping("/doctors")
    public ResponseEntity<?> createDoctor(@RequestBody CreateDoctorRequest req) {
        if (userRepo.findByEmail(req.email()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A user with email '" + req.email() + "' already exists"));
        }
        var u = userService.register(req.email(), req.fullName(), req.password(), Role.DOCTOR);
        Doctor d = Doctor.builder()
                .user(u)
                .specialization(req.specialization())
                .phone(req.phone())
                .consultationFee(req.consultationFee() != null ? req.consultationFee() : BigDecimal.valueOf(500))
                .build();
        return ResponseEntity.ok(doctorRepo.save(d));
    }

    @GetMapping("/doctors")
    public List<Doctor> listDoctors() {
        return doctorRepo.findAll();
    }

    @GetMapping("/doctors/{id}")
    public ResponseEntity<Doctor> getDoctor(@PathVariable("id") Long id) {
        return doctorRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/doctors/{id}")
    public ResponseEntity<?> updateDoctor(@PathVariable("id") Long id,
                                          @RequestBody UpdateDoctorRequest req) {
        return doctorRepo.findById(id).map(doctor -> {
            String newEmail = req.email();
            if (newEmail != null && doctor.getUser() != null
                    && !newEmail.equals(doctor.getUser().getEmail())) {
                var existing = userRepo.findByEmail(newEmail);
                if (existing.isPresent() && !existing.get().getId().equals(doctor.getUser().getId())) {
                    return ResponseEntity.badRequest()
                            .<Object>body(Map.of("message", "Email '" + newEmail + "' is already in use"));
                }
            }
            if (req.specialization() != null) doctor.setSpecialization(req.specialization());
            if (req.phone() != null) doctor.setPhone(req.phone());
            if (req.consultationFee() != null) doctor.setConsultationFee(req.consultationFee());
            if (doctor.getUser() != null) {
                if (req.fullName() != null) doctor.getUser().setFullName(req.fullName());
                if (newEmail != null) doctor.getUser().setEmail(newEmail);
                userRepo.save(doctor.getUser());
            }
            return ResponseEntity.ok(doctorRepo.save(doctor));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/doctors/{id}")
    public ResponseEntity<?> deleteDoctor(@PathVariable("id") Long id) {
        if (!doctorRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        doctorRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Doctor deleted successfully"));
    }

    // ─── Receptionist Management ──────────────────────────────────────────────

    @PostMapping("/receptionists")
    public ResponseEntity<?> createReceptionist(@RequestBody CreateUserRequest req) {
        if (userRepo.findByEmail(req.email()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "A user with email '" + req.email() + "' already exists"));
        }
        var u = userService.register(req.email(), req.fullName(), req.password(), Role.RECEPTIONIST);
        return ResponseEntity.ok(u);
    }

    @GetMapping("/receptionists")
    public List<User> listReceptionists() {
        return userRepo.findByRolesName("RECEPTIONIST");
    }

    @GetMapping("/receptionists/{id}")
    public ResponseEntity<User> getReceptionist(@PathVariable("id") Long id) {
        return userRepo.findById(id)
                .filter(u -> u.getRoles().stream().anyMatch(r -> "RECEPTIONIST".equals(r.getName())))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/receptionists/{id}")
    public ResponseEntity<?> updateReceptionist(@PathVariable("id") Long id,
                                                @RequestBody UpdateUserRequest req) {
        return userRepo.findById(id)
                .filter(u -> u.getRoles().stream().anyMatch(r -> "RECEPTIONIST".equals(r.getName())))
                .map(user -> {
                    if (req.email() != null && !req.email().equals(user.getEmail())) {
                        var existing = userRepo.findByEmail(req.email());
                        if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                            return ResponseEntity.badRequest()
                                    .<Object>body(Map.of("message",
                                            "Email '" + req.email() + "' is already in use"));
                        }
                    }
                    if (req.fullName() != null) user.setFullName(req.fullName());
                    if (req.email() != null) user.setEmail(req.email());
                    user.setEnabled(req.enabledOrDefault());
                    return ResponseEntity.ok(userRepo.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/receptionists/{id}")
    public ResponseEntity<?> deleteReceptionist(@PathVariable("id") Long id) {
        if (!userRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepo.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Receptionist deleted successfully"));
    }

    // ─── User status toggle ───────────────────────────────────────────────────

    @PutMapping("/users/{id}/toggle-status")
    public ResponseEntity<?> toggleUserStatus(@PathVariable("id") Long id) {
        return userRepo.findById(id).map(user -> {
            user.setEnabled(!user.isEnabled());
            userRepo.save(user);
            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "enabled", user.isEnabled(),
                    "message", user.getFullName() + " has been "
                            + (user.isEnabled() ? "enabled" : "disabled")
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ─── Dashboard stats ──────────────────────────────────────────────────────

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

    // ─── All users ────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public List<User> getAllUsers() {
        return userRepo.findAll();
    }
}
