package com.chatter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.lang.NonNull;

@SpringBootApplication
@EnableWebSocket
public class ChatterApplication implements WebSocketConfigurer {

    public static void main(String[] args) {
        SpringApplication.run(ChatterApplication.class, args);
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(chatWebSocketHandler(), "/ws")
                .setAllowedOrigins("http://localhost:5173", "http://localhost:5174")
                .withSockJS();
    }

    @Bean
    public ChatWebSocketHandler chatWebSocketHandler() {
        return new ChatWebSocketHandler();
    }
} 