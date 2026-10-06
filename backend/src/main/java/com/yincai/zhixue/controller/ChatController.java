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

    public static final long MAX_IMAGE_DATA_LENGTH = 12L * 1024 * 1024;
    private static final String[] SUPPORTED_MIME_TYPES = {
            "image/jpeg", "image/png", "image/gif", "image/webp"
    };

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest()
                    .body(new ChatResponse("请求不能为空。"));
        }

        String question = request.getQuestion() == null ? "" : request.getQuestion().trim();
        String imageData = request.getImageData();
        boolean hasImage = imageData != null && !imageData.isBlank();

        if (question.isBlank() && !hasImage) {
            return ResponseEntity.badRequest()
                    .body(new ChatResponse("请输入问题或上传图片。"));
        }

        if (hasImage) {
            if (imageData.length() > MAX_IMAGE_DATA_LENGTH) {
                return ResponseEntity.badRequest()
                        .body(new ChatResponse("图片太大了，请压缩到 8MB 左右后再试。"));
            }
            String mimeType = request.getImageMimeType() == null
                    ? ""
                    : request.getImageMimeType().trim().toLowerCase();

            if (!isSupportedMimeType(mimeType)) {
                return ResponseEntity.badRequest()
                        .body(new ChatResponse("暂时只支持 JPG、PNG、GIF、WebP 图片。"));
            }

            if (!imageData.startsWith("data:" + mimeType + ";base64,")) {
                return ResponseEntity.badRequest()
                        .body(new ChatResponse("图片数据格式无效，请重新上传。"));
            }
        }

        try {
            String answer = hasImage
                    ? chatService.chatWithImage(question, imageData, request.getImageMimeType())
                    : chatService.chat(question);

            return ResponseEntity.ok(new ChatResponse(answer));
        } catch (IllegalStateException ex) {
            return ResponseEntity.internalServerError()
                    .body(new ChatResponse(ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(502)
                    .body(new ChatResponse("AI 服务暂时不可用，请稍后再试。"));
        }
    }

    private boolean isSupportedMimeType(String mimeType) {
        for (String supported : SUPPORTED_MIME_TYPES) {
            if (supported.equals(mimeType)) return true;
        }
        return false;
    }
}
