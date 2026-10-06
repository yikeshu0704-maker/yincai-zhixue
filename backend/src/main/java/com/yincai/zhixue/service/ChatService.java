package com.yincai.zhixue.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class ChatService {

    private static final String DEFAULT_SYSTEM_PROMPT = """
            你是“因材智学”的 AI 数学助教。
            你的目标不是直接把答案扔给学生，而是帮助学生真正学会。

            回答原则：
            1. 先判断学生卡在哪里。
            2. 默认先给提示，而不是直接给完整答案。
            3. 根据学生的反馈逐步增加提示强度。
            4. 如果学生仍然不会，再进行详细讲解。
            5. 只有学生明确需要时，再提供完整解法。
            6. 语言适合初中数学学生，表达清楚、简洁、有步骤。
            7. 不要虚构学生没有提供的学习记录。
            8. 如果题目本身信息不足，先指出缺失信息。
            """;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final long requestTimeoutSeconds;

    public ChatService(
            ObjectMapper objectMapper,
            @Value("${model.base-url}") String baseUrl,
            @Value("${model.api-key}") String apiKey,
            @Value("${model.name}") String model,
            @Value("${model.connect-timeout-seconds:10}") long connectTimeoutSeconds,
            @Value("${model.request-timeout-seconds:90}") long requestTimeoutSeconds) {

        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.requestTimeoutSeconds = requestTimeoutSeconds;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(connectTimeoutSeconds))
                .build();
    }

    public String chat(String question) {
        return chatWithPrompt(DEFAULT_SYSTEM_PROMPT, question);
    }

    public String chatWithPrompt(String systemPrompt, String userPrompt) {
        validateConfiguration();

        try {
            var body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("temperature", 0.3);

            var messages = body.putArray("messages");

            var system = messages.addObject();
            system.put("role", "system");
            system.put("content", systemPrompt);

            var user = messages.addObject();
            user.put("role", "user");
            user.put("content", userPrompt);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl))
                    .timeout(Duration.ofSeconds(requestTimeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(body)
                    ))
                    .build();

            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException(
                        "模型 API 返回 HTTP " + response.statusCode()
                );
            }

            JsonNode root = objectMapper.readTree(response.body());
            String answer = root.path("choices")
                    .path(0)
                    .path("message")
                    .path("content")
                    .asText("");

            if (answer == null || answer.isBlank()) {
                throw new RuntimeException("模型返回内容为空");
            }

            return answer.trim();

        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("AI 请求被中断", ex);
        } catch (IOException ex) {
            throw new RuntimeException("无法连接模型 API", ex);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("MODEL_BASE_URL 配置无效", ex);
        }
    }

    private void validateConfiguration() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "尚未配置 MODEL_API_KEY。请先在本机环境变量中设置你的大模型 API Key。"
            );
        }

        if (model == null || model.isBlank()) {
            throw new IllegalStateException(
                    "尚未配置 MODEL_NAME。请先设置模型名称。"
            );
        }

        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException(
                    "尚未配置 MODEL_BASE_URL。请先设置模型 API 地址。"
            );
        }
    }
}
