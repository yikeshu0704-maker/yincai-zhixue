package com.yincai.zhixue.dto;

/**
 * POST /api/chat 请求体。
 *
 * 文本模式：
 * { "question": "你好" }
 *
 * 图片模式：
 * {
 *   "question": "请帮我看这道题",
 *   "imageData": "data:image/png;base64,...",
 *   "imageMimeType": "image/png"
 * }
 */
public class ChatRequest {

    private String question;
    private String imageData;
    private String imageMimeType;

    public ChatRequest() {
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getImageData() {
        return imageData;
    }

    public void setImageData(String imageData) {
        this.imageData = imageData;
    }

    public String getImageMimeType() {
        return imageMimeType;
    }

    public void setImageMimeType(String imageMimeType) {
        this.imageMimeType = imageMimeType;
    }
}
