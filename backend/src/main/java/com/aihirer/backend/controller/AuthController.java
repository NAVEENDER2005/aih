package com.aihirer.backend.controller;

import com.aihirer.backend.dto.JwtResponse;
import com.aihirer.backend.dto.LoginRequest;
import com.aihirer.backend.dto.SignupRequest;
import com.aihirer.backend.model.User;
import com.aihirer.backend.repository.UserRepository;
import com.aihirer.backend.security.JwtUtils;
import com.aihirer.backend.security.UserDetailsImpl;
import com.aihirer.backend.service.CandidateProfileAnalyzerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    CandidateProfileAnalyzerService candidateProfileAnalyzerService;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken((UserDetailsImpl) authentication.getPrincipal());

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String role = userDetails.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");

        return ResponseEntity
                .ok(new JwtResponse(jwt, userDetails.getId(), userDetails.getName(), userDetails.getUsername(), role));
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        if (userRepository.findByEmail(signUpRequest.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Error: Email is already in use!");
        }

        User user = User.builder()
                .name(signUpRequest.getName())
                .email(signUpRequest.getEmail())
                .password(encoder.encode(signUpRequest.getPassword()))
                .role(signUpRequest.getRole())
                .experienceLevel(signUpRequest.getExperienceLevel())
                .githubProfile(signUpRequest.getGithubProfile())
                .linkedinProfile(signUpRequest.getLinkedinProfile())
                .interestedRole(signUpRequest.getInterestedRole())
                .build();

        userRepository.save(user);

        // Trigger async AI analysis
        candidateProfileAnalyzerService.analyzeProfileAsync(user);

        return ResponseEntity.ok("User registered successfully!");
    }
}
