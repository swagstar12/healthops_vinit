package com.healthops.api;

import com.healthops.visit.VisitRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasAnyRole('ADMIN','DOCTOR','RECEPTIONIST')")
public class ReportController {

  private final VisitRepository visitRepo;
  public ReportController(VisitRepository visitRepo) { this.visitRepo = visitRepo; }

  @GetMapping("/patient/{patientId}/visits.csv")
  public ResponseEntity<byte[]> downloadVisitsCsv(@PathVariable Long patientId) {
    var visits = visitRepo.findByPatientIdOrderByVisitAtDesc(patientId);
    String header = "Visit At,Doctor Id,Appointment Id,Diagnosis,Prescription,Notes\n";
    String body = visits.stream().map(v -> String.join(",",
        v.getVisitAt().toString(),
        v.getDoctor() != null ? String.valueOf(v.getDoctor().getId()) : "",
        v.getAppointment() != null ? String.valueOf(v.getAppointment().getId()) : "",
        safe(v.getDiagnosis()),
        safe(v.getPrescription()),
        safe(v.getNotes())
    )).collect(Collectors.joining("\n"));
    String csv = header + body + "\n";
    byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=patient-"+patientId+"-visits.csv")
        .contentType(MediaType.TEXT_PLAIN)
        .body(bytes);
  }

  private String safe(String s) { return s == null ? "" : s.replaceAll("[\r\n,]", " "); }
}
