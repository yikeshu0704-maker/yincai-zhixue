package com.yincai.zhixue.controller;

import com.yincai.zhixue.dto.ChatRequest;
import com.yincai.zhixue.dto.ChatResponse;
import com.yincai.zhixue.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ChatResponse("问题不能为空，请先输入你想问的内容。"));
        }

        try {
            return ResponseEntity.ok(
                    new ChatResponse(chatService.chat(request.getQuestion().trim()))
            );
        } catch (IllegalStateException ex) {
            return ResponseEntity.internalServerError()
                    .body(new ChatResponse(ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(502)
                    .body(new ChatResponse("AI 服务暂时不可用，请稍后再试。"));
        }
    }
}
