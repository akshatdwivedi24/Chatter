package com.chatter.service;

import com.chatter.model.Friend;
import com.chatter.model.FriendStatus;
import com.chatter.repository.FriendRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FriendService {

    @Autowired
    private FriendRepository friendRepository;

    public Friend sendFriendRequest(String userId, String friendId) {
        if (userId.equals(friendId)) {
            throw new IllegalArgumentException("Cannot send friend request to yourself");
        }

        return friendRepository.findFriendship(userId, friendId)
                .orElseGet(() -> friendRepository.save(new Friend(userId, friendId)));
    }

    public Friend updateFriendRequestStatus(Long requestId, FriendStatus status, String userEmail) {
        Friend friend = friendRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Friend request not found"));
        
        // Only the recipient of the request can accept/reject it
        if (!friend.getFriendId().equals(userEmail)) {
            throw new AccessDeniedException("You can only respond to friend requests sent to you");
        }
        
        friend.setStatus(status);
        return friendRepository.save(friend);
    }

    public List<Friend> getPendingRequests(String userId) {
        return friendRepository.findByFriendIdAndStatus(userId, FriendStatus.PENDING);
    }

    public List<Friend> getAcceptedFriends(String userId) {
        return friendRepository.findAllAcceptedFriends(userId);
    }

    public void removeFriend(String userId, String friendId) {
        Friend friend = friendRepository.findFriendship(userId, friendId)
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));
        friendRepository.delete(friend);
    }

    public boolean areFriends(String userId, String friendId) {
        return friendRepository.findFriendship(userId, friendId)
                .map(friend -> friend.getStatus() == FriendStatus.ACCEPTED)
                .orElse(false);
    }
} 