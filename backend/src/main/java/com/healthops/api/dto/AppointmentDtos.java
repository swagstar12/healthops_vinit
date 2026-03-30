package com.healthops.api.dto;

import java.time.Instant;

public class AppointmentDtos {
  public record CreateAppointmentRequest(Long patientId, Long doctorId, Instant scheduledAt, String reason) {}
  public record UpdateAppointmentRequest(Instant scheduledAt, String reason, String status) {}
  public record UpdateStatusRequest(String status) {}
}