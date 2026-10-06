package com.yincai.zhixue.dto;

/**
 * POST /api/chat 返回体。
 *
 * 示例：
 * { "answer": "你好，我是因材智学 AI 助教。" }
 */
public class ChatResponse {

    private String answer;

    public ChatResponse() {
    }

    public ChatResponse(String answer) {
        this.answer = answer;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
