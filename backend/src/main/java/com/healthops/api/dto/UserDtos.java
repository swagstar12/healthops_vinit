package com.healthops.api.dto;

public class UserDtos {
  public record CreateUserRequest(String email, String fullName, String password) {}
  public record UpdateUserRequest(String fullName, String email, boolean enabled) {}
}