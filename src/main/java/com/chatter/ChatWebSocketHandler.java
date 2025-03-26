package com.chatter;

import com.chatter.model.Message;
import com.chatter.service.MessageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.lang.NonNull;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Autowired
    private MessageService messageService;

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        sessions.put(session.getId(), session);
        // Send last 50 messages to new user
        try {
            messageService.getLastMessages().forEach(msg -> {
                try {
                    String messageJson = objectMapper.writeValueAsString(msg);
                    System.out.println("Sending message: " + messageJson); // Debug log
                    session.sendMessage(new TextMessage(messageJson));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        sessions.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        // Parse the message
        Message chatMessage = objectMapper.readValue(message.getPayload(), Message.class);
        
        // Save the message to database
        Message savedMessage = messageService.saveMessage(chatMessage.getSender(), chatMessage.getContent());
        
        // Broadcast the message to all connected clients
        String messageJson = objectMapper.writeValueAsString(savedMessage);
        System.out.println("Broadcasting message: " + messageJson); // Debug log
        for (WebSocketSession webSocketSession : sessions.values()) {
            webSocketSession.sendMessage(new TextMessage(messageJson));
        }
    }
}