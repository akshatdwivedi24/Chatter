package com.chatter.service;

import com.chatter.model.User;
import com.chatter.repository.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    @Value("${google.client-id}")
    private String clientId;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private JwtService jwtService;

    private GoogleIdTokenVerifier verifier;

    @PostConstruct
    public void init() {
        this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                .setAudience(Collections.singletonList(clientId))
                .build();
    }

    public Map<String, Object> verifyGoogleToken(String token) throws Exception {
        GoogleIdToken idToken = verifier.verify(token);
        if (idToken == null) {
            throw new Exception("Invalid token");
        }

        GoogleIdToken.Payload payload = idToken.getPayload();
        String email = payload.getEmail();
        
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setEmail(email);
                    newUser.setName((String) payload.get("name"));
                    newUser.setProfilePicture((String) payload.get("picture"));
                    newUser.setGoogleUser(true);
                    return userRepository.save(newUser);
                });
                
        // Generate JWT token
        String jwtToken = jwtService.generateToken(email);

        return Map.of(
            "token", jwtToken,
            "user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "profilePicture", user.getProfilePicture(),
                "sub", email  // Add the subject (email) as sub for easier access in frontend
            )
        );
    }
} 