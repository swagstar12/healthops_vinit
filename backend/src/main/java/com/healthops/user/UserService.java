package com.healthops.user;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.HashSet;
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
    var u = userRepo.findByEmail(email).orElseThrow(() -> new UsernameNotFoundException("Not found"));
    Set<GrantedAuthority> auths = u.getRoles().stream()
        .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getName()))
        .collect(Collectors.toSet());
    return new org.springframework.security.core.userdetails.User(u.getEmail(), u.getPassword(), u.isEnabled(), true, true, true, auths);
  }

  public User register(String email, String fullName, String password, Role role) {
    var roleEntity = roleRepo.findByName(role.name()).orElseThrow();
    
    var u = User.builder()
        .email(email)
        .fullName(fullName)
        .password(password)
        .build();
    
    // Add the role to the default-initialized roles set
    u.getRoles().add(roleEntity);
    
    return userRepo.save(u);
  }
}