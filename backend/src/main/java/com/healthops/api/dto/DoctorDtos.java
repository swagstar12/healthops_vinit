package com.healthops.api.dto;

import java.time.LocalTime;
import java.time.LocalDate;

public class DoctorDtos {
  public record CreateDoctorRequest(String email, String fullName, String password, String specialization, String phone) {}
  public record UpdateDoctorRequest(String email, String fullName, String specialization, String phone) {}
  public record AvailabilityRequest(int dayOfWeek, LocalTime startTime, LocalTime endTime) {}
  public record HolidayRequest(LocalDate date, String reason) {}
}