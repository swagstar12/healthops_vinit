package com.healthops.api.dto;

public class UserDtos {
    public record CreateUserRequest(String email, String fullName, String password) {}

    // enabled is Boolean (boxed) so it can be null when not sent from frontend
    public record UpdateUserRequest(String fullName, String email, Boolean enabled) {
        // Convenience: treat null as true (don't accidentally disable on partial update)
        public boolean enabled() {
            return enabled != null ? enabled : true;
        }
    }
}
