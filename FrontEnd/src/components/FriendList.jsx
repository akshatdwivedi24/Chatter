import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/friends.css';

const FriendList = ({ user, onSelectFriend }) => {
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [newFriendEmail, setNewFriendEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('friends'); // 'friends' or 'requests'

    // Fetch friends and pending requests
    useEffect(() => {
        if (user && user.sub) {
            fetchFriends();
            fetchPendingRequests();
        }
    }, [user]);

    const fetchFriends = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:8081/api/friends/accepted`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setFriends(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching friends:', err);
            setError('Failed to load friends. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:8081/api/friends/pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setPendingRequests(response.data);
        } catch (err) {
            console.error('Error fetching pending requests:', err);
        }
    };

    const sendFriendRequest = async (e) => {
        e.preventDefault();
        if (!newFriendEmail.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            const token = localStorage.getItem('token');
            console.log('Sending friend request with token:', token);
            
            if (!token) {
                throw new Error('Authentication token not found. Please log in again.');
            }
            
            await axios.post('http://localhost:8081/api/friends/request', null, {
                params: {
                    friendId: newFriendEmail // Only need friendId now
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setNewFriendEmail('');
            setSuccessMessage('Friend request sent successfully!');
            
            // Reset success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);
        } catch (err) {
            console.error('Error sending friend request:', err);
            setError(err.response?.data?.message || 'Failed to send friend request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const acceptFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:8081/api/friends/request/${requestId}`, null, {
                params: { status: 'ACCEPTED' },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // Refresh lists
            fetchFriends();
            fetchPendingRequests();
        } catch (err) {
            console.error('Error accepting friend request:', err);
            setError('Failed to accept friend request. Please try again.');
        }
    };

    const rejectFriendRequest = async (requestId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:8081/api/friends/request/${requestId}`, null, {
                params: { status: 'REJECTED' },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // Remove from pending requests
            setPendingRequests(pendingRequests.filter(req => req.id !== requestId));
        } catch (err) {
            console.error('Error rejecting friend request:', err);
            setError('Failed to reject friend request. Please try again.');
        }
    };

    const removeFriend = async (friendId) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:8081/api/friends/${friendId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            // Remove from friends list
            setFriends(friends.filter(f => 
                (f.userId !== friendId && f.friendId !== friendId)
            ));
        } catch (err) {
            console.error('Error removing friend:', err);
            setError('Failed to remove friend. Please try again.');
        }
    };

    const handleMessageClick = (friend) => {
        // Determine if the current user is userId or friendId
        const friendId = friend.userId === user.sub ? friend.friendId : friend.userId;
        const friendEmail = friendId; // Currently using email as the ID
        const friendName = friendId.split('@')[0]; // Extract name from email
        
        onSelectFriend({
            id: friendId,
            name: friendName,
            email: friendEmail
        });
    };

    return (
        <div className="friends-container">
            <div className="friends-tabs">
                <button 
                    className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                >
                    Friends ({friends.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests ({pendingRequests.length})
                    {pendingRequests.length > 0 && <span className="notification-badge"></span>}
                </button>
            </div>

            <div className="add-friend-form">
                <form onSubmit={sendFriendRequest}>
                    <input
                        type="text"
                        placeholder="Enter friend's email"
                        value={newFriendEmail}
                        onChange={(e) => setNewFriendEmail(e.target.value)}
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !newFriendEmail.trim()}>
                        Add Friend
                    </button>
                </form>
                {error && <div className="error-message">{error}</div>}
                {successMessage && <div className="success-message">{successMessage}</div>}
            </div>

            {activeTab === 'friends' ? (
                <div className="friends-list">
                    <h3>My Friends</h3>
                    {isLoading ? (
                        <div className="loading">Loading friends...</div>
                    ) : friends.length === 0 ? (
                        <div className="empty-message">You don't have any friends yet.</div>
                    ) : (
                        <ul>
                            {friends.map(friend => {
                                // Determine if the current user is userId or friendId
                                const friendId = friend.userId === user.sub ? friend.friendId : friend.userId;
                                // Extract name from email (if possible)
                                const friendName = friendId.split('@')[0];
                                
                                return (
                                    <li key={friend.id} className="friend-item">
                                        <div className="friend-info">
                                            <div className="avatar">
                                                {friendName.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="friend-details">
                                                <div className="friend-name">{friendName}</div>
                                                <div className="friend-email">{friendId}</div>
                                                <div className="friend-status">Online</div>
                                            </div>
                                        </div>
                                        <div className="friend-actions">
                                            <button 
                                                className="message-btn"
                                                onClick={() => handleMessageClick(friend)}
                                            >
                                                Message
                                            </button>
                                            <button 
                                                className="remove-btn"
                                                onClick={() => removeFriend(friendId)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ) : (
                <div className="friend-requests">
                    <h3>Friend Requests</h3>
                    {pendingRequests.length === 0 ? (
                        <div className="empty-message">No pending friend requests.</div>
                    ) : (
                        <ul>
                            {pendingRequests.map(request => (
                                <li key={request.id} className="request-item">
                                    <div className="request-info">
                                        <div className="avatar">
                                            {request.userId.substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="request-details">
                                            <div className="requester-name">{request.userId.split('@')[0]}</div>
                                            <div className="requester-email">{request.userId}</div>
                                            <div className="request-time">
                                                {new Date(request.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="request-actions">
                                        <button 
                                            className="accept-btn"
                                            onClick={() => acceptFriendRequest(request.id)}
                                        >
                                            Accept
                                        </button>
                                        <button 
                                            className="reject-btn"
                                            onClick={() => rejectFriendRequest(request.id)}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default FriendList; 