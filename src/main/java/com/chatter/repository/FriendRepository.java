package com.chatter.repository;

import com.chatter.model.Friend;
import com.chatter.model.FriendStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Long> {
    
    @Query("SELECT f FROM Friend f WHERE (f.userId = ?1 AND f.friendId = ?2) OR (f.userId = ?2 AND f.friendId = ?1)")
    Optional<Friend> findFriendship(String userId, String friendId);
    
    @Query("SELECT f FROM Friend f WHERE (f.userId = ?1 OR f.friendId = ?1) AND f.status = ?2")
    List<Friend> findAllByUserAndStatus(String userId, FriendStatus status);
    
    List<Friend> findByFriendIdAndStatus(String friendId, FriendStatus status);
    
    @Query("SELECT f FROM Friend f WHERE f.userId = ?1 AND f.status = 'ACCEPTED' OR (f.friendId = ?1 AND f.status = 'ACCEPTED')")
    List<Friend> findAllAcceptedFriends(String userId);
} 