package com.yincai.zhixue.controller;

import com.yincai.zhixue.dto.AgentRequest;
import com.yincai.zhixue.dto.AgentResponse;
import com.yincai.zhixue.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AgentController {

    private static final Map<String, String> SYSTEM_PROMPTS = Map.of(
            "analysis", """
                    你是“因材智学”的学情分析 Agent。
                    你的任务是把学生自填信息、测试结果、答题表现、错题和时间约束综合起来，
                    判断当前最值得干预的知识点，并给出有证据的优先级。
                    不要编造不存在的数据。
                    输出给前端时用中文、简洁、可执行。
                    """,
            "plan", """
                    你是“因材智学”的学习路径规划 Agent。
                    你需要根据学生当前掌握度、薄弱点、考试目标、剩余天数和每日可用学习时间，
                    生成阶段化、可执行的学习路径。
                    优先解决短板，但不要一次把任务堆满。
                    计划必须包含基础修复、综合训练、错题复盘和掌握检验。
                    输出中文，按周/阶段清晰组织。
                    """,
            "mistake", """
                    你是“因材智学”的错题复盘 Agent。
                    你需要从原错题和学生错误中判断：
                    1. 错误原因
                    2. 知识点
                    3. 错误类型
                    4. 下一步应该做什么训练
                    最后说明怎样检验是否真正掌握。
                    不要直接跳过诊断。
                    """,
            "skill", """
                    你是“因材智学”的技能训练 Agent。
                    你根据学生当前知识点掌握度、当前难度、连续答对次数和最近表现动态出题。
                    基础掌握稳定时，减少基础题，向中等、综合、变式推进；出现明显错误时降低难度。
                    本次需要生成一道真正可作答的新题。
                    严格只返回一个合法 JSON 对象，不要 Markdown，不要额外说明：
                    {
                      "level":"基础题/中等题/综合题/变式题",
                      "label":"基础训练/中等应用/综合应用/迁移变式",
                      "question":"题目",
                      "options":{"A":"选项A","B":"选项B","C":"选项C","D":"选项D"},
                      "answer":"A/B/C/D",
                      "explanation":"一句话说明考查点"
                    }
                    """,
            "motivation", """
                    你是“因材智学”的学习激励 Agent。
                    你不负责让学生学更多，而是根据完成率、连续学习、未完成任务和薄弱点，
                    判断今天应该继续、维持还是收尾。
                    要优先保护高价值任务和学习负荷，避免无意义加任务。
                    输出两部分：
                    第一行以“建议：”开头，给出继续/维持/收尾。
                    第二段解释原因和今天最值得做的事情。
                    """
    );

    private final ChatService chatService;

    public AgentController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/agent")
    public ResponseEntity<AgentResponse> run(@RequestBody AgentRequest request) {
        if (request == null || request.getAgent() == null || request.getAgent().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new AgentResponse("缺少 agent 类型。"));
        }

        String systemPrompt = SYSTEM_PROMPTS.get(request.getAgent());
        if (systemPrompt == null) {
            return ResponseEntity.badRequest()
                    .body(new AgentResponse("不支持的 agent 类型：" + request.getAgent()));
        }

        String context = request.getContext() == null ? "" : request.getContext().trim();
        if (context.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new AgentResponse("缺少 Agent 所需的上下文信息。"));
        }

        try {
            return ResponseEntity.ok(
                    new AgentResponse(chatService.chatWithPrompt(systemPrompt, context))
            );
        } catch (IllegalStateException ex) {
            return ResponseEntity.internalServerError()
                    .body(new AgentResponse(ex.getMessage()));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(502)
                    .body(new AgentResponse("Agent 服务暂时不可用，请稍后再试。"));
        }
    }
}
