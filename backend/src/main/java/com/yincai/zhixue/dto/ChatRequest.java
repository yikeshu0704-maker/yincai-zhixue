package com.yincai.zhixue.dto;

/**
 * POST /api/chat 请求体。
 *
 * 示例：
 * { "question": "你好" }
 */
public class ChatRequest {

    private String question;

    public ChatRequest() {
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }
}
