package com.healthops.api;

import com.healthops.api.dto.AuthDtos.*;
import com.healthops.security.JwtService;
import com.healthops.user.Role;
import com.healthops.user.User;
import com.healthops.user.UserRepository;
import com.healthops.user.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthenticationManager authManager;
  private final JwtService jwt;
  private final UserService userService;
  private final UserRepository userRepo;

  public AuthController(AuthenticationManager authManager, JwtService jwt, UserService userService, UserRepository userRepo) {
    this.authManager = authManager; this.jwt = jwt; this.userService = userService; this.userRepo = userRepo;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody @Valid LoginRequest req) {
    try {
      authManager.authenticate(new UsernamePasswordAuthenticationToken(req.email(), req.password()));
    } catch (BadCredentialsException e) {
      return ResponseEntity.status(401).build();
    }
    User u = userRepo.findByEmail(req.email()).orElseThrow();
    String role = u.getRoles().stream().findFirst().map(r -> r.getName()).orElse("UNKNOWN");
    String token = jwt.generate(u.getEmail(), Map.of("role", role, "name", u.getFullName()));
    return ResponseEntity.ok(new LoginResponse(token, role, u.getFullName()));
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest req) {
    Role role = Role.valueOf(req.role().toUpperCase());
    var u = userService.register(req.email(), req.fullName(), req.password(), role);
    return ResponseEntity.ok(Map.of("id", u.getId()));
  }

  @GetMapping("/test")
  public ResponseEntity<String> test() {
      return ResponseEntity.ok("Auth endpoint is working!");
  }
}
