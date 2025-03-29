package com.chatter.controller;

import com.chatter.model.Message;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;

@RestController
@CrossOrigin(origins = "*")
public class ChatController {

    @MessageMapping("/chat")
    @SendTo("/topic/messages")
    public Message sendMessage(Message message) {
        message.setTimestamp(LocalDateTime.now());
        // Broadcast the message to all subscribers
        return message;
    }

    @MessageMapping("/typing")
    @SendTo("/topic/typing")
    public Message handleTyping(Message message) {
        message.setTimestamp(LocalDateTime.now());
        return message;
    }

    @MessageMapping("/message-status")
    @SendTo("/topic/message-status")
    public Message updateMessageStatus(Message message) {
        message.setTimestamp(LocalDateTime.now());
        return message;
    }
} 