package com.healthops.api.dto;

public class AuthDtos {
  public record LoginRequest(String email, String password) {}
  public record LoginResponse(String token, String role, String fullName) {}
  public record RegisterRequest(String email, String fullName, String password, String role) {}
}
