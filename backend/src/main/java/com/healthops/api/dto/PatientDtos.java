package com.healthops.api.dto;

import java.time.LocalDate;

public class PatientDtos {
  public record CreatePatientRequest(String code, String fullName, LocalDate dob, String phone, String address) {}
  public record UpdatePatientRequest(String fullName, LocalDate dob, String phone, String address) {}
}
