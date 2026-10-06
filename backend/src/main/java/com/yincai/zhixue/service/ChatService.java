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

    public String chatWithImage(String question, String imageData, String imageMimeType) {
        validateConfiguration();

        String safeQuestion = question == null || question.isBlank()
                ? "请先识别这张图片中的数学题，再判断我卡在哪里，并先给我提示，不要直接给完整答案。"
                : question.trim();

        try {
            var body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("temperature", 0.3);

            var messages = body.putArray("messages");

            var system = messages.addObject();
            system.put("role", "system");
            system.put("content", DEFAULT_SYSTEM_PROMPT);

            var user = messages.addObject();
            user.put("role", "user");
            var content = user.putArray("content");

            var textBlock = content.addObject();
            textBlock.put("type", "text");
            textBlock.put("text", safeQuestion);

            var imageBlock = content.addObject();
            imageBlock.put("type", "image_url");
            var imageUrl = imageBlock.putObject("image_url");
            imageUrl.put("url", imageData);

            return sendRequest(body);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("图片请求格式无效", ex);
        }
    }

    public String chatWithJsonPrompt(String systemPrompt, String userPrompt) {
        validateConfiguration();

        RuntimeException structuredError = null;

        // 第一层：DeepSeek 原生 JSON Output。
        try {
            var body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("temperature", 0.2);
            body.put("max_tokens", 1800);

            var thinking = body.putObject("thinking");
            thinking.put("type", "disabled");

            var responseFormat = body.putObject("response_format");
            responseFormat.put("type", "json_object");

            var messages = body.putArray("messages");

            var system = messages.addObject();
            system.put("role", "system");
            system.put("content",
                    systemPrompt
                            + "\n\n只输出一个完整合法的 JSON 对象。"
                            + "\n必须包含 system prompt 中要求的字段。"
                            + "\n不要 Markdown、不要代码块、不要额外解释文字。");

            var user = messages.addObject();
            user.put("role", "user");
            user.put("content", userPrompt
                    + "\n\n请立即返回完整 JSON 对象。");

            String answer = sendRequest(body);
            String normalized = normalizeJson(answer);
            if (normalized != null) {
                return normalized;
            }
            structuredError = new RuntimeException("JSON Output 返回内容无法解析");
        } catch (RuntimeException ex) {
            structuredError = ex;
        }

        // 第二层：关闭 JSON Output，用普通文本请求兜底，再从文本中提取 JSON。
        try {
            var fallbackBody = objectMapper.createObjectNode();
            fallbackBody.put("model", model);
            fallbackBody.put("temperature", 0.1);
            fallbackBody.put("max_tokens", 1800);

            var fallbackThinking = fallbackBody.putObject("thinking");
            fallbackThinking.put("type", "disabled");

            var messages = fallbackBody.putArray("messages");

            var system = messages.addObject();
            system.put("role", "system");
            system.put("content",
                    systemPrompt
                            + "\n\n你的回复必须是一个完整 JSON 对象。"
                            + "即使不能严格满足，也不要解释，只返回 JSON。");

            var user = messages.addObject();
            user.put("role", "user");
            user.put("content", userPrompt);

            String answer = sendRequest(fallbackBody);
            String normalized = normalizeJson(answer);
            if (normalized != null) {
                return normalized;
            }

            throw new RuntimeException("普通文本兜底返回内容也无法解析为 JSON");
        } catch (RuntimeException fallbackError) {
            String first = structuredError == null ? "未知结构化请求错误" : structuredError.getMessage();
            String second = fallbackError.getMessage() == null ? "未知兜底请求错误" : fallbackError.getMessage();
            throw new RuntimeException("Agent 结构化调用失败。首选 JSON：" + first + "；兜底请求：" + second, fallbackError);
        }
    }

    private String normalizeJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String cleaned = raw.trim()
                .replace("\u0060\u0060\u0060json", "")
                .replace("\u0060\u0060\u0060JSON", "")
                .replace("\u0060\u0060\u0060", "")
                .trim();

        try {
            JsonNode direct = objectMapper.readTree(cleaned);
            if (direct != null && direct.isObject()) {
                return objectMapper.writeValueAsString(direct);
            }
        } catch (Exception ignored) {
            // 尝试从前后杂讯中提取第一个完整 JSON 对象。
        }

        int start = cleaned.indexOf('{');
        if (start < 0) {
            return null;
        }

        boolean inString = false;
        boolean escaped = false;
        int depth = 0;

        for (int i = start; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i);

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }

            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    String candidate = cleaned.substring(start, i + 1);
                    try {
                        JsonNode node = objectMapper.readTree(candidate);
                        if (node != null && node.isObject()) {
                            return objectMapper.writeValueAsString(node);
                        }
                    } catch (Exception ignored) {
                        return null;
                    }
                }
            }
        }

        return null;
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

            return sendRequest(body);

        } catch (IllegalArgumentException ex) {
            throw new RuntimeException("MODEL_BASE_URL 配置无效", ex);
        }
    }

    private String sendRequest(JsonNode body) {
        try {
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
                String detail = response.body() == null ? "" : response.body();
                if (detail.length() > 500) detail = detail.substring(0, 500);
                throw new RuntimeException("模型 API 返回 HTTP " + response.statusCode() + ": " + detail);
            }

            JsonNode root = objectMapper.readTree(response.body());
            String answer = root.path("choices")
                    .path(0)
                    .path("message")
                    .path("content")
                    .asText("");

            if (answer == null || answer.isBlank()) {
                String finishReason = root.path("choices").path(0).path("finish_reason").asText("");
                if (!finishReason.isBlank()) {
                    throw new RuntimeException("模型返回内容为空，finish_reason=" + finishReason);
                }
                throw new RuntimeException("模型返回内容为空");
            }

            return answer.trim();

        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("AI 请求被中断", ex);
        } catch (IOException ex) {
            throw new RuntimeException("无法连接模型 API", ex);
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
