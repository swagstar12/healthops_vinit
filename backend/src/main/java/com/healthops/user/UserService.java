package com.healthops.user;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserService implements UserDetailsService {

    private final UserRepository userRepo;
    private final RoleRepository roleRepo;

    public UserService(UserRepository userRepo, RoleRepository roleRepo) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        var u = userRepo.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        Set<GrantedAuthority> auths = u.getRoles().stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getName()))
                .collect(Collectors.toSet());
        return new org.springframework.security.core.userdetails.User(
                u.getEmail(), u.getPassword(),
                u.isEnabled(), true, true, true,
                auths);
    }

    public User register(String email, String fullName, String password, Role role) {
        // Guard: role must exist in DB (seeded by DataLoader / Flyway)
        var roleEntity = roleRepo.findByName(role.name())
                .orElseThrow(() -> new IllegalStateException(
                        "Role '" + role.name() + "' not found in database. " +
                        "Ensure the application has started at least once so seed data is loaded."));

        // Guard: duplicate email
        if (userRepo.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("A user with email '" + email + "' already exists");
        }

        var u = User.builder()
                .email(email)
                .fullName(fullName)
                .password(password)
                .build();
        u.getRoles().add(roleEntity);
        return userRepo.save(u);
    }
}
