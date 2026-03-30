package com.healthops.api;

import com.healthops.api.dto.AppointmentDtos.*;
import com.healthops.api.dto.PatientDtos.*;
import com.healthops.api.dto.DoctorDtos.*;
import com.healthops.appointment.Appointment;
import com.healthops.appointment.AppointmentRepository;
import com.healthops.doctor.Doctor;
import com.healthops.doctor.DoctorRepository;
import com.healthops.doctor.Availability;
import com.healthops.doctor.AvailabilityRepository;
import com.healthops.doctor.Holiday;
import com.healthops.doctor.HolidayRepository;
import com.healthops.patient.Patient;
import com.healthops.patient.PatientRepository;
import com.healthops.visit.VisitRepository;
import com.healthops.user.Role;
import com.healthops.user.UserService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reception")
@PreAuthorize("hasRole('RECEPTIONIST') or hasRole('ADMIN')")
public class ReceptionistController {

  private final PatientRepository patientRepo;
  private final AppointmentRepository apptRepo;
  private final DoctorRepository doctorRepo;
  private final UserService userService;
  private final VisitRepository visitRepo;
  private final AvailabilityRepository availRepo;
  private final HolidayRepository holidayRepo;

  public ReceptionistController(PatientRepository patientRepo, AppointmentRepository apptRepo, 
                               DoctorRepository doctorRepo, UserService userService,
                               VisitRepository visitRepo, AvailabilityRepository availRepo,
                               HolidayRepository holidayRepo) {
    this.patientRepo = patientRepo; 
    this.apptRepo = apptRepo; 
    this.doctorRepo = doctorRepo; 
    this.userService = userService;
    this.visitRepo = visitRepo;
    this.availRepo = availRepo;
    this.holidayRepo = holidayRepo;
  }

  // Enhanced Patient Management
  @PostMapping("/patients")
  public Patient createPatient(@RequestBody CreatePatientRequest req) {
    var p = Patient.builder()
        .code(req.code())
        .fullName(req.fullName())
        .dob(req.dob())
        .phone(req.phone())
        .address(req.address())
        .build();
    return patientRepo.save(p);
  }

  @GetMapping("/patients")
  public List<Patient> listPatients() { 
    return patientRepo.findAll(); 
  }

  @GetMapping("/patients/{id}")
  public ResponseEntity<Patient> getPatient(@PathVariable Long id) {
    return patientRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/patients/{id}")
  public ResponseEntity<Patient> updatePatient(@PathVariable Long id, @RequestBody UpdatePatientRequest req) {
    return patientRepo.findById(id).map(p -> {
      p.setFullName(req.fullName()); 
      p.setDob(req.dob()); 
      p.setPhone(req.phone()); 
      p.setAddress(req.address());
      return ResponseEntity.ok(patientRepo.save(p));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/patients/{id}")
  public ResponseEntity<?> deletePatient(@PathVariable Long id) { 
    if (patientRepo.existsById(id)) {
      patientRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Enhanced Doctor Management
  @PostMapping("/doctors")
  public Doctor addDoctor(@RequestBody CreateDoctorRequest req) {
    var u = userService.register(req.email(), req.fullName(), req.password(), Role.DOCTOR);
    var d = Doctor.builder()
        .user(u)
        .specialization(req.specialization())
        .phone(req.phone())
        .build();
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

  @DeleteMapping("/doctors/{id}")
  public ResponseEntity<?> deleteDoctor(@PathVariable Long id) { 
    if (doctorRepo.existsById(id)) {
      doctorRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Doctor Availability Management (for receptionists to manage)
  @PostMapping("/doctors/{doctorId}/availability")
  public Availability addDoctorAvailability(@PathVariable Long doctorId, @RequestBody AvailabilityRequest req) {
    var doctor = doctorRepo.findById(doctorId).orElseThrow();
    var availability = Availability.builder()
        .doctor(doctor)
        .dayOfWeek(req.dayOfWeek())
        .startTime(req.startTime())
        .endTime(req.endTime())
        .build();
    return availRepo.save(availability);
  }

  @GetMapping("/doctors/{doctorId}/availability")
  public List<Availability> getDoctorAvailability(@PathVariable Long doctorId) {
    return availRepo.findByDoctorId(doctorId);
  }

  @PutMapping("/availability/{id}")
  public ResponseEntity<Availability> updateAvailability(@PathVariable Long id, @RequestBody AvailabilityRequest req) {
    return availRepo.findById(id).map(avail -> {
      avail.setDayOfWeek(req.dayOfWeek());
      avail.setStartTime(req.startTime());
      avail.setEndTime(req.endTime());
      return ResponseEntity.ok(availRepo.save(avail));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/availability/{id}")
  public ResponseEntity<?> deleteAvailability(@PathVariable Long id) {
    if (availRepo.existsById(id)) {
      availRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Doctor Holiday Management (for receptionists to manage)
  @PostMapping("/doctors/{doctorId}/holidays")
  public Holiday addDoctorHoliday(@PathVariable Long doctorId, @RequestBody HolidayRequest req) {
    var doctor = doctorRepo.findById(doctorId).orElseThrow();
    var holiday = Holiday.builder()
        .doctor(doctor)
        .date(req.date())
        .reason(req.reason())
        .build();
    return holidayRepo.save(holiday);
  }

  @GetMapping("/doctors/{doctorId}/holidays")
  public List<Holiday> getDoctorHolidays(@PathVariable Long doctorId) {
    return holidayRepo.findByDoctorId(doctorId);
  }

  @PutMapping("/holidays/{id}")
  public ResponseEntity<Holiday> updateHoliday(@PathVariable Long id, @RequestBody HolidayRequest req) {
    return holidayRepo.findById(id).map(holiday -> {
      holiday.setDate(req.date());
      holiday.setReason(req.reason());
      return ResponseEntity.ok(holidayRepo.save(holiday));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/holidays/{id}")
  public ResponseEntity<?> deleteHoliday(@PathVariable Long id) {
    if (holidayRepo.existsById(id)) {
      holidayRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Enhanced Appointment Management
  @PostMapping("/appointments")
  public Appointment createAppointment(@RequestBody CreateAppointmentRequest req) {
    var p = patientRepo.findById(req.patientId()).orElseThrow();
    var d = doctorRepo.findById(req.doctorId()).orElseThrow();
    var a = Appointment.builder()
        .patient(p)
        .doctor(d)
        .scheduledAt(req.scheduledAt())
        .status("SCHEDULED")
        .reason(req.reason())
        .build();
    return apptRepo.save(a);
  }

  @GetMapping("/appointments")
  public List<Appointment> listAppointments() { 
    return apptRepo.findAll(); 
  }

  @GetMapping("/appointments/{id}")
  public ResponseEntity<Appointment> getAppointment(@PathVariable Long id) {
    return apptRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/appointments/{id}")
  public ResponseEntity<Appointment> updateAppointment(@PathVariable Long id, @RequestBody UpdateAppointmentRequest req) {
    return apptRepo.findById(id).map(appointment -> {
      appointment.setScheduledAt(req.scheduledAt());
      appointment.setReason(req.reason());
      appointment.setStatus(req.status());
      return ResponseEntity.ok(apptRepo.save(appointment));
    }).orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/appointments/{id}/status")
  public ResponseEntity<Appointment> updateStatus(@PathVariable Long id, @RequestBody UpdateStatusRequest req) {
    return apptRepo.findById(id).map(a -> {
      a.setStatus(req.status());
      return ResponseEntity.ok(apptRepo.save(a));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/appointments/{id}")
  public ResponseEntity<?> deleteAppointment(@PathVariable Long id) {
    if (apptRepo.existsById(id)) {
      apptRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Visit History
  @GetMapping("/patients/{patientId}/visits")
  public List<com.healthops.visit.Visit> getPatientVisitHistory(@PathVariable Long patientId) {
    return visitRepo.findByPatientIdOrderByVisitAtDesc(patientId);
  }

  @GetMapping("/visits")
  public List<com.healthops.visit.Visit> getAllVisits() {
    return visitRepo.findAll();
  }

  // Enhanced Reports
  @GetMapping("/reports/patients.csv")
  public ResponseEntity<byte[]> downloadPatientsReport() {
    var patients = patientRepo.findAll();
    
    String header = "Patient Code,Full Name,Date of Birth,Phone,Address,Total Visits\n";
    String body = patients.stream().map(p -> String.join(",",
        safe(p.getCode()),
        safe(p.getFullName()),
        p.getDob() != null ? p.getDob().toString() : "",
        safe(p.getPhone()),
        safe(p.getAddress()),
        String.valueOf(visitRepo.countByPatientId(p.getId()))
    )).collect(Collectors.joining("\n"));
    
    String csv = header + body + "\n";
    byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=patients-report.csv")
        .contentType(MediaType.TEXT_PLAIN)
        .body(bytes);
  }

  @GetMapping("/reports/patient/{patientId}/visits.csv")
  public ResponseEntity<byte[]> downloadPatientVisitsReport(@PathVariable Long patientId) {
    var visits = visitRepo.findByPatientIdOrderByVisitAtDesc(patientId);
    var patient = patientRepo.findById(patientId).orElseThrow();
    
    String header = "Visit Date,Doctor,Diagnosis,Prescription,Notes\n";
    String body = visits.stream().map(v -> String.join(",",
        v.getVisitAt().toString(),
        v.getDoctor() != null ? safe(v.getDoctor().getUser().getFullName()) : "",
        safe(v.getDiagnosis()),
        safe(v.getPrescription()),
        safe(v.getNotes())
    )).collect(Collectors.joining("\n"));
    
    String csv = header + body + "\n";
    byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=patient-" + patient.getCode() + "-visits.csv")
        .contentType(MediaType.TEXT_PLAIN)
        .body(bytes);
  }

  @GetMapping("/reports/appointments.csv")
  public ResponseEntity<byte[]> downloadAppointmentsReport() {
    var appointments = apptRepo.findAll();
    
    String header = "Appointment ID,Patient Code,Patient Name,Doctor,Scheduled Date,Status,Reason\n";
    String body = appointments.stream().map(a -> String.join(",",
        String.valueOf(a.getId()),
        safe(a.getPatient().getCode()),
        safe(a.getPatient().getFullName()),
        a.getDoctor() != null ? safe(a.getDoctor().getUser().getFullName()) : "",
        a.getScheduledAt().toString(),
        safe(a.getStatus()),
        safe(a.getReason())
    )).collect(Collectors.joining("\n"));
    
    String csv = header + body + "\n";
    byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=appointments-report.csv")
        .contentType(MediaType.TEXT_PLAIN)
        .body(bytes);
  }

  // Dashboard Statistics
  @GetMapping("/dashboard/stats")
  public Map<String, Object> getDashboardStats() {
    return Map.of(
        "totalPatients", patientRepo.count(),
        "totalDoctors", doctorRepo.count(),
        "totalAppointments", apptRepo.count(),
        "todayAppointments", apptRepo.countTodayAppointments(),
        "scheduledAppointments", apptRepo.countByStatus("SCHEDULED"),
        "completedAppointments", apptRepo.countByStatus("COMPLETED"),
        "cancelledAppointments", apptRepo.countByStatus("CANCELLED"),
        "totalVisits", visitRepo.count()
    );
  }

  // Search functionality
  @GetMapping("/patients/search")
  public List<Patient> searchPatients(@RequestParam String query) {
    return patientRepo.findByFullNameContainingIgnoreCaseOrCodeContainingIgnoreCase(query, query);
  }

  @GetMapping("/appointments/search")
  public List<Appointment> searchAppointments(@RequestParam String query) {
    return apptRepo.searchByPatientNameOrCode(query);
  }


  private String safe(String s) { 
    return s == null ? "" : s.replaceAll("[\r\n,]", " "); 
  }
}