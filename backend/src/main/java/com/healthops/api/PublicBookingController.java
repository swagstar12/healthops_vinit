package com.healthops.api;

import com.healthops.appointment.Appointment;
import com.healthops.appointment.AppointmentRepository;
import com.healthops.doctor.Availability;
import com.healthops.doctor.AvailabilityRepository;
import com.healthops.doctor.Doctor;
import com.healthops.doctor.DoctorRepository;
import com.healthops.doctor.Holiday;
import com.healthops.doctor.HolidayRepository;
import com.healthops.patient.Patient;
import com.healthops.patient.PatientRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public")
public class PublicBookingController {

    private final DoctorRepository doctorRepo;
    private final AvailabilityRepository availRepo;
    private final HolidayRepository holidayRepo;
    private final PatientRepository patientRepo;
    private final AppointmentRepository appointmentRepo;

    public PublicBookingController(DoctorRepository doctorRepo,
                                   AvailabilityRepository availRepo,
                                   HolidayRepository holidayRepo,
                                   PatientRepository patientRepo,
                                   AppointmentRepository appointmentRepo) {
        this.doctorRepo = doctorRepo;
        this.availRepo = availRepo;
        this.holidayRepo = holidayRepo;
        this.patientRepo = patientRepo;
        this.appointmentRepo = appointmentRepo;
    }

    /** List all doctors with their availability — public endpoint */
    @GetMapping("/doctors")
    public List<Map<String, Object>> listDoctorsPublic() {
        return doctorRepo.findAll().stream().map(d -> {
            List<Availability> slots = availRepo.findByDoctorId(d.getId());
            List<Holiday> holidays = holidayRepo.findByDoctorId(d.getId());
            return Map.<String, Object>of(
                "id", d.getId(),
                "name", d.getUser() != null ? d.getUser().getFullName() : "Unknown",
                "specialization", d.getSpecialization() != null ? d.getSpecialization() : "",
                "phone", d.getPhone() != null ? d.getPhone() : "",
                "availability", slots,
                "holidays", holidays.stream()
                    .map(h -> Map.of("date", h.getDate().toString(), "reason", h.getReason() != null ? h.getReason() : ""))
                    .collect(Collectors.toList())
            );
        }).collect(Collectors.toList());
    }

    /** Book appointment as a patient — public endpoint */
    @PostMapping("/book-appointment")
    public ResponseEntity<?> bookAppointment(@RequestBody BookingRequest req) {
        // Validate required fields
        if (req.patientName() == null || req.patientName().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Patient name is required"));
        if (req.patientPhone() == null || req.patientPhone().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Phone number is required"));
        if (req.doctorId() == null)
            return ResponseEntity.badRequest().body(Map.of("message", "Please select a doctor"));
        if (req.scheduledAt() == null)
            return ResponseEntity.badRequest().body(Map.of("message", "Please select a date and time"));

        Doctor doctor = doctorRepo.findById(req.doctorId()).orElse(null);
        if (doctor == null)
            return ResponseEntity.badRequest().body(Map.of("message", "Selected doctor not found"));

        // Check doctor availability on that day
        LocalDate appointmentDate = req.scheduledAt().atZone(ZoneId.systemDefault()).toLocalDate();
        int dayOfWeek = appointmentDate.getDayOfWeek().getValue(); // 1=Mon...7=Sun

        List<Availability> slots = availRepo.findByDoctorId(doctor.getId());
        boolean available = slots.stream().anyMatch(s -> s.getDayOfWeek() == dayOfWeek);
        if (!available)
            return ResponseEntity.badRequest().body(Map.of("message",
                "Dr. " + doctor.getUser().getFullName() + " is not available on " +
                appointmentDate.getDayOfWeek().toString().charAt(0) +
                appointmentDate.getDayOfWeek().toString().substring(1).toLowerCase()));

        // Check doctor holiday
        boolean onHoliday = holidayRepo.existsByDoctorIdAndDate(doctor.getId(), appointmentDate);
        if (onHoliday)
            return ResponseEntity.badRequest().body(Map.of("message",
                "Dr. " + doctor.getUser().getFullName() + " is on leave on that date"));

        // Find or create patient by phone
        Patient patient = patientRepo.findAll().stream()
            .filter(p -> req.patientPhone().equals(p.getPhone()))
            .findFirst()
            .orElseGet(() -> {
                // Auto-generate patient code
                long count = patientRepo.count() + 1000;
                Patient np = Patient.builder()
                    .code(String.valueOf(count))
                    .fullName(req.patientName().trim())
                    .phone(req.patientPhone().trim())
                    .build();
                return patientRepo.save(np);
            });

        Appointment appt = Appointment.builder()
            .patient(patient)
            .doctor(doctor)
            .scheduledAt(req.scheduledAt())
            .status("SCHEDULED")
            .reason(req.reason())
            .build();

        Appointment saved = appointmentRepo.save(appt);

        return ResponseEntity.ok(Map.of(
            "message", "Appointment booked successfully!",
            "appointmentId", saved.getId(),
            "patientCode", patient.getCode(),
            "doctorName", "Dr. " + doctor.getUser().getFullName(),
            "scheduledAt", saved.getScheduledAt().toString()
        ));
    }

    public record BookingRequest(
        String patientName,
        String patientPhone,
        Long doctorId,
        Instant scheduledAt,
        String reason
    ) {}
}
