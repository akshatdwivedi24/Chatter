package com.chatter.service;

import com.chatter.model.Message;
import com.chatter.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class MessageService {
    
    @Autowired
    private MessageRepository messageRepository;

    public Message saveMessage(String sender, String content) {
        Message message = new Message();
        message.setSender(sender);
        message.setContent(content);
        message.setTimestamp(LocalDateTime.now(ZoneOffset.UTC));
        return messageRepository.save(message);
    }

    public List<Message> getLastMessages() {
        return messageRepository.findTop50ByOrderByTimestampDesc();
    }
} 