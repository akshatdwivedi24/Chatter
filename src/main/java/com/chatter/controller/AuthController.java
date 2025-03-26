package com.chatter.controller;

import com.chatter.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"}, allowCredentials = "true")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/google")
    public ResponseEntity<?> googleAuth(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            if (token == null || token.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Token is required"));
            }
            Map<String, Object> userInfo = authService.verifyGoogleToken(token);
            return ResponseEntity.ok(userInfo);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
        }
    }
} 