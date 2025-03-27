import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/friends.css';

const FriendList = ({ user, onSelectFriend }) => {
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [groups, setGroups] = useState([]);
    const [newFriendEmail, setNewFriendEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', or 'groups'
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState({ name: '', letter: '' });
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState([]);

    // Fetch friends, pending requests, and groups
    useEffect(() => {
        if (user && user.sub) {
            fetchFriends();
            fetchPendingRequests();
            fetchGroups();
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

    const fetchGroups = async () => {
        try {
            const token = localStorage.getItem('token');
            // This endpoint would need to be implemented on the backend
            const response = await axios.get(`http://localhost:8081/api/groups`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(() => {
                // For now, use mock data if the endpoint isn't implemented
                return { 
                    data: [
                        { id: 'group1', name: 'Friends Group', members: ['friend1@example.com', 'friend2@example.com'] },
                        { id: 'group2', name: 'Work Team', members: ['colleague1@example.com', 'boss@example.com'] }
                    ] 
                };
            });
            setGroups(response.data);
        } catch (err) {
            console.error('Error fetching groups:', err);
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
            email: friendEmail,
            isGroup: false
        });
    };

    const handleGroupClick = (group) => {
        onSelectFriend({
            id: group.id,
            name: group.name,
            members: group.members,
            isGroup: true
        });
    };

    const handleAvatarClick = (name, letter) => {
        setSelectedAvatar({ name, letter });
        setShowAvatarModal(true);
    };

    const closeAvatarModal = () => {
        setShowAvatarModal(false);
    };

    const openCreateGroupModal = () => {
        setShowCreateGroupModal(true);
        setNewGroupName('');
        setSelectedFriendsForGroup([]);
    };

    const closeCreateGroupModal = () => {
        setShowCreateGroupModal(false);
    };

    const toggleFriendSelection = (friendId) => {
        if (selectedFriendsForGroup.includes(friendId)) {
            setSelectedFriendsForGroup(selectedFriendsForGroup.filter(id => id !== friendId));
        } else {
            setSelectedFriendsForGroup([...selectedFriendsForGroup, friendId]);
        }
    };

    const createGroup = async () => {
        if (newGroupName.trim() === '' || selectedFriendsForGroup.length === 0) {
            setError('Please enter a group name and select at least one friend.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            // This endpoint would need to be implemented on the backend
            await axios.post('http://localhost:8081/api/groups', {
                name: newGroupName,
                members: selectedFriendsForGroup
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }).catch(() => {
                // For now, just simulate success if the endpoint isn't implemented
                console.log('Creating group (simulated):', { name: newGroupName, members: selectedFriendsForGroup });
                
                // Add to local state for demo purposes
                const newGroup = { 
                    id: 'group' + Date.now(), 
                    name: newGroupName, 
                    members: selectedFriendsForGroup 
                };
                setGroups([...groups, newGroup]);
            });
            
            setSuccessMessage('Group created successfully!');
            closeCreateGroupModal();
            
            // Switch to groups tab
            setActiveTab('groups');
            
            // Reset success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);
        } catch (err) {
            console.error('Error creating group:', err);
            setError('Failed to create group. Please try again.');
        }
    };

    // Avatar Modal Component
    const AvatarModal = () => {
        if (!showAvatarModal) return null;
        
        return (
            <div className="avatar-modal-overlay" onClick={closeAvatarModal}>
                <div className="avatar-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="avatar-modal-header">
                        <h3>{selectedAvatar.name}</h3>
                        <button className="close-button" onClick={closeAvatarModal}>
                            <i className="fa fa-times"></i>
                        </button>
                    </div>
                    <div className="avatar-modal-body">
                        <div className="large-avatar">
                            {selectedAvatar.letter}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Create Group Modal Component
    const CreateGroupModal = () => {
        if (!showCreateGroupModal) return null;
        
        return (
            <div className="modal-overlay" onClick={closeCreateGroupModal}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Create New Group</h3>
                        <button className="close-button" onClick={closeCreateGroupModal}>
                            <i className="fa fa-times"></i>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="group-name">Group Name</label>
                            <input
                                type="text"
                                id="group-name"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Enter group name"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Select Friends</label>
                            <div className="friend-selection-list">
                                {friends.length === 0 ? (
                                    <div className="empty-message">You don't have any friends to add.</div>
                                ) : (
                                    <ul>
                                        {friends.map(friend => {
                                            const friendId = friend.userId === user.sub ? friend.friendId : friend.userId;
                                            const friendName = friendId.split('@')[0];
                                            const isSelected = selectedFriendsForGroup.includes(friendId);
                                            
                                            return (
                                                <li 
                                                    key={friend.id} 
                                                    className={`friend-selection-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => toggleFriendSelection(friendId)}
                                                >
                                                    <div className="friend-select-info">
                                                        <div className="avatar">
                                                            {friendName.substring(0, 1).toUpperCase()}
                                                        </div>
                                                        <div className="friend-select-details">
                                                            <div className="friend-name">{friendName}</div>
                                                            <div className="friend-email">{friendId}</div>
                                                        </div>
                                                    </div>
                                                    <div className="selection-indicator">
                                                        {isSelected && <i className="fa fa-check"></i>}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="cancel-btn" onClick={closeCreateGroupModal}>Cancel</button>
                        <button 
                            className="create-group-btn" 
                            onClick={createGroup}
                            disabled={newGroupName.trim() === '' || selectedFriendsForGroup.length === 0}
                        >
                            Create Group
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="friends-container">
            <AvatarModal />
            <CreateGroupModal />
            
            <div className="friends-tabs">
                <button 
                    className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                >
                    Friends ({friends.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveTab('groups')}
                >
                    Groups ({groups.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests ({pendingRequests.length})
                    {pendingRequests.length > 0 && <span className="notification-badge"></span>}
                </button>
            </div>

            {activeTab === 'friends' && (
                <>
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
                                    const avatarLetter = friendName.substring(0, 1).toUpperCase();
                                    
                                    return (
                                        <li key={friend.id} className="friend-item">
                                            <div className="friend-info">
                                                <div 
                                                    className="avatar"
                                                    onClick={() => handleAvatarClick(friendName, avatarLetter)}
                                                >
                                                    {avatarLetter}
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
                </>
            )}

            {activeTab === 'groups' && (
                <>
                    <div className="add-group-section">
                        <button className="create-group-btn" onClick={openCreateGroupModal}>
                            <i className="fa fa-users"></i> Create New Group
                        </button>
                        {error && <div className="error-message">{error}</div>}
                        {successMessage && <div className="success-message">{successMessage}</div>}
                    </div>

                    <div className="groups-list">
                        <h3>My Groups</h3>
                        {groups.length === 0 ? (
                            <div className="empty-message">You don't have any groups yet.</div>
                        ) : (
                            <ul>
                                {groups.map(group => (
                                    <li key={group.id} className="group-item">
                                        <div className="group-info">
                                            <div className="group-avatar">
                                                <i className="fa fa-users"></i>
                                            </div>
                                            <div className="group-details">
                                                <div className="group-name">{group.name}</div>
                                                <div className="group-members">
                                                    {group.members.length} members
                                                </div>
                                            </div>
                                        </div>
                                        <div className="group-actions">
                                            <button 
                                                className="message-btn"
                                                onClick={() => handleGroupClick(group)}
                                            >
                                                Open
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'requests' && (
                <div className="friend-requests">
                    <h3>Friend Requests</h3>
                    {pendingRequests.length === 0 ? (
                        <div className="empty-message">No pending friend requests.</div>
                    ) : (
                        <ul>
                            {pendingRequests.map(request => {
                                const avatarLetter = request.userId.substring(0, 1).toUpperCase();
                                const requesterName = request.userId.split('@')[0];
                                
                                return (
                                    <li key={request.id} className="request-item">
                                        <div className="request-info">
                                            <div 
                                                className="avatar"
                                                onClick={() => handleAvatarClick(requesterName, avatarLetter)}
                                            >
                                                {avatarLetter}
                                            </div>
                                            <div className="request-details">
                                                <div className="requester-name">{requesterName}</div>
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
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default FriendList; 