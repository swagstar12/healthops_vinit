package com.healthops.api.dto;

public class UserDtos {
    public record CreateUserRequest(String email, String fullName, String password) {}

    public record UpdateUserRequest(String fullName, String email, Boolean enabled) {
        // No custom accessor — record accessor must match component type exactly.
        // Use enabledOrDefault() for null-safe access.
        public boolean enabledOrDefault() {
            return enabled != null ? enabled : true;
        }
    }
}