package com.chatter.controller;

import com.chatter.model.Friend;
import com.chatter.model.FriendStatus;
import com.chatter.service.FriendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"})
public class FriendController {

    @Autowired
    private FriendService friendService;

    @PostMapping("/request")
    public ResponseEntity<Friend> sendFriendRequest(
            @RequestParam String friendId,
            Authentication authentication) {
        String userEmail = authentication.getName(); // Get email from JWT token
        return ResponseEntity.ok(friendService.sendFriendRequest(userEmail, friendId));
    }

    @PutMapping("/request/{requestId}")
    public ResponseEntity<Friend> updateFriendRequest(
            @PathVariable Long requestId,
            @RequestParam FriendStatus status,
            Authentication authentication) {
        // Verify the user owns this request before updating it
        return ResponseEntity.ok(friendService.updateFriendRequestStatus(requestId, status, authentication.getName()));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<Friend>> getPendingRequests(Authentication authentication) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(friendService.getPendingRequests(userEmail));
    }

    @GetMapping("/accepted")
    public ResponseEntity<List<Friend>> getAcceptedFriends(Authentication authentication) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(friendService.getAcceptedFriends(userEmail));
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> removeFriend(
            @PathVariable String friendId,
            Authentication authentication) {
        String userEmail = authentication.getName();
        friendService.removeFriend(userEmail, friendId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/status/{friendId}")
    public ResponseEntity<Boolean> checkFriendshipStatus(
            @PathVariable String friendId,
            Authentication authentication) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(friendService.areFriends(userEmail, friendId));
    }
} 