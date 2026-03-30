package com.healthops.api;

import com.healthops.api.dto.DoctorDtos.AvailabilityRequest;
import com.healthops.api.dto.DoctorDtos.HolidayRequest;
import com.healthops.api.dto.VisitDtos.CreateVisitRequest;
import com.healthops.api.dto.VisitDtos.UpdateVisitRequest;
import com.healthops.doctor.*;
import com.healthops.patient.Patient;
import com.healthops.patient.PatientRepository;
import com.healthops.visit.Visit;
import com.healthops.visit.VisitRepository;
import com.healthops.appointment.AppointmentRepository;
import com.healthops.user.User;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/doctor")
@PreAuthorize("hasRole('DOCTOR') or hasRole('ADMIN')")
public class DoctorController {
  private final DoctorRepository doctorRepo;
  private final AvailabilityRepository availRepo;
  private final HolidayRepository holidayRepo;
  private final PatientRepository patientRepo;
  private final VisitRepository visitRepo;
  private final AppointmentRepository appointmentRepo;

  public DoctorController(DoctorRepository doctorRepo, AvailabilityRepository availRepo, 
                         HolidayRepository holidayRepo, PatientRepository patientRepo, 
                         VisitRepository visitRepo, AppointmentRepository appointmentRepo) {
    this.doctorRepo = doctorRepo; 
    this.availRepo = availRepo; 
    this.holidayRepo = holidayRepo; 
    this.patientRepo = patientRepo; 
    this.visitRepo = visitRepo;
    this.appointmentRepo = appointmentRepo;
  }

  // Get current doctor's information
  @GetMapping("/profile")
  public ResponseEntity<Doctor> getCurrentDoctor(Authentication auth) {
    String email = auth.getName();
    return doctorRepo.findByUserEmail(email)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  // Patient Management
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
  public ResponseEntity<Patient> editPatient(@PathVariable Long id, @RequestBody Patient updated) {
    return patientRepo.findById(id).map(p -> {
      p.setFullName(updated.getFullName());
      p.setDob(updated.getDob());
      p.setPhone(updated.getPhone());
      p.setAddress(updated.getAddress());
      return ResponseEntity.ok(patientRepo.save(p));
    }).orElse(ResponseEntity.notFound().build());
  }

  // Visit Management
  @PostMapping("/visits")
  public Visit createVisit(@RequestBody CreateVisitRequest req, Authentication auth) {
    var patient = patientRepo.findById(req.patientId()).orElseThrow();
    var appointment = req.appointmentId() != null ? 
        appointmentRepo.findById(req.appointmentId()).orElse(null) : null;
    
    // Get current doctor
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    
    var visit = Visit.builder()
        .patient(patient)
        .doctor(doctor)
        .appointment(appointment)
        .visitAt(Instant.now())
        .notes(req.notes())
        .diagnosis(req.diagnosis())
        .prescription(req.prescription())
        .build();
    
    return visitRepo.save(visit);
  }

  @GetMapping("/visits")
  public List<Visit> getAllVisits(Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    return visitRepo.findByDoctorIdOrderByVisitAtDesc(doctor.getId());
  }

  @GetMapping("/visits/patient/{patientId}")
  public List<Visit> getPatientVisits(@PathVariable Long patientId) {
    return visitRepo.findByPatientIdOrderByVisitAtDesc(patientId);
  }

  @GetMapping("/visits/{id}")
  public ResponseEntity<Visit> getVisit(@PathVariable Long id) {
    return visitRepo.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping("/visits/{id}")
  public ResponseEntity<Visit> updateVisit(@PathVariable Long id, @RequestBody UpdateVisitRequest req) {
    return visitRepo.findById(id).map(visit -> {
      visit.setNotes(req.notes());
      visit.setDiagnosis(req.diagnosis());
      visit.setPrescription(req.prescription());
      return ResponseEntity.ok(visitRepo.save(visit));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/visits/{id}")
  public ResponseEntity<?> deleteVisit(@PathVariable Long id) {
    if (visitRepo.existsById(id)) {
      visitRepo.deleteById(id);
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.notFound().build();
  }

  // Availability Management
  @PostMapping("/availability")
  public Availability addAvailability(@RequestBody AvailabilityRequest req, Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    var a = Availability.builder()
        .doctor(doctor)
        .dayOfWeek(req.dayOfWeek())
        .startTime(req.startTime())
        .endTime(req.endTime())
        .build();
    return availRepo.save(a);
  }

  @GetMapping("/availability")
  public List<Availability> getAvailability(Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    return availRepo.findByDoctorId(doctor.getId());
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

  // Holiday Management
  @PostMapping("/holidays")
  public Holiday addHoliday(@RequestBody HolidayRequest req, Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    var h = Holiday.builder()
        .doctor(doctor)
        .date(req.date())
        .reason(req.reason())
        .build();
    return holidayRepo.save(h);
  }

  @GetMapping("/holidays")
  public List<Holiday> getHolidays(Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    return holidayRepo.findByDoctorId(doctor.getId());
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

  // Reports
  @GetMapping("/reports/visits.csv")
  public ResponseEntity<byte[]> downloadAllVisitsCsv(Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    var visits = visitRepo.findByDoctorIdOrderByVisitAtDesc(doctor.getId());
    
    String header = "Visit Date,Patient Code,Patient Name,Diagnosis,Prescription,Notes\n";
    String body = visits.stream().map(v -> String.join(",",
        v.getVisitAt().toString(),
        v.getPatient().getCode(),
        safe(v.getPatient().getFullName()),
        safe(v.getDiagnosis()),
        safe(v.getPrescription()),
        safe(v.getNotes())
    )).collect(Collectors.joining("\n"));
    
    String csv = header + body + "\n";
    byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=doctor-visits-report.csv")
        .contentType(MediaType.TEXT_PLAIN)
        .body(bytes);
  }

  @GetMapping("/reports/patient/{patientId}/visits.csv")
  public ResponseEntity<byte[]> downloadPatientVisitsCsv(@PathVariable Long patientId) {
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

  // Dashboard Stats
  @GetMapping("/dashboard/stats")
  public Map<String, Object> getDashboardStats(Authentication auth) {
    var doctor = doctorRepo.findByUserEmail(auth.getName()).orElseThrow();
    return Map.of(
        "totalPatients", patientRepo.count(),
        "myVisitsCount", visitRepo.countByDoctorId(doctor.getId()),
        "todayVisits", visitRepo.countTodayVisitsByDoctor(doctor.getId()),
        "myAppointments", appointmentRepo.countByDoctorId(doctor.getId()),
        "availabilitySlots", availRepo.countByDoctorId(doctor.getId()),
        "upcomingHolidays", holidayRepo.countUpcomingByDoctorId(doctor.getId())
    );
  }

  private String safe(String s) { 
    return s == null ? "" : s.replaceAll("[\r\n,]", " "); 
  }
}