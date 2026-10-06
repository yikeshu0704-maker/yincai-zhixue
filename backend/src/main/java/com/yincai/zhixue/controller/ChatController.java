package com.yincai.zhixue.controller;

import com.yincai.zhixue.dto.ChatRequest;
import com.yincai.zhixue.dto.ChatResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 答疑聊天接口。
 *
 * 第一阶段：固定回复，仅验证 前端 -> 后端 -> 前端 通信链路。
 * 后续阶段：在此接入大模型 API。
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {
        // 暂时返回固定文案，跑通通信链路；不接大模型
        return new ChatResponse("你好，我是因材智学 AI 助教。");
    }
}
