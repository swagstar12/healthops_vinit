package com.healthops.api.dto;

public class VisitDtos {
  public record CreateVisitRequest(Long appointmentId, Long patientId, String notes, String diagnosis, String prescription) {}
  public record UpdateVisitRequest(String notes, String diagnosis, String prescription) {}
}