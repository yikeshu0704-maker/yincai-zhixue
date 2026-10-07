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
                    严禁编造学生没有提供的分数或掌握度。
                    如果没有足够数据判断数值掌握度，就返回 null，不要猜数字。
                    严格只返回一个合法 json 对象，不要 Markdown，不要代码块。输出必须是 json：
                    {
                      "summary":"一句话总体判断",
                      "priorities":[
                        {
                          "name":"知识点名称",
                          "priority":"高/中/低/待诊断",
                          "mastery":null,
                          "evidence":"依据"
                        }
                      ],
                      "recommendedAction":"下一步最重要的学习动作"
                    }
                    """,
            "plan", """
                    你是“因材智学”的学习路径规划 Agent。
                    你需要根据学生当前学情、考试目标、剩余天数和每日可用学习时间，
                    生成阶段化、可执行的学习路径。
                    不要制造没有依据的掌握度数字。
                    严格只返回一个合法 JSON 对象，不要 Markdown，不要代码块：
                    {
                      "title":"计划标题",
                      "highestPriority":"最高优先级知识点",
                      "secondPriority":"第二优先级知识点",
                      "stable":"当前相对稳定的知识点；若没有足够证据则写待诊断",
                      "dailyMinutes":120,
                      "weeks":[
                        {
                          "week":"第1阶段",
                          "focus":"训练重点",
                          "goal":"阶段目标",
                          "minutesPerDay":40,
                          "reason":"为什么安排这一阶段"
                        }
                      ],
                      "adjustment":"后续如何根据表现动态调整"
                    }
                    阶段数量根据剩余时间合理决定，重点是可执行，而不是输出长篇文章。
                    """,
            "mistake", """
                    你是“因材智学”的错题复盘 Agent。
                    你的目标是让学生真正把这道题重新学会，而不是只给一个标签。
                    必须识别错误原因、定位最具体知识点，并给出原题从审题到最终答案的完整可执行解法。
                    如果学生提供了主动反馈，必须结合反馈重新判断。
                    严禁编造学生没有提供的事实。
                    严格只返回一个合法 JSON：
                    {
                      "reason":"一句话错误根因",
                      "knowledge":"最具体核心知识点",
                      "errorType":"概念理解/条件提取/计算执行/思路组织/审题/其他",
                      "evidence":"来自原题、学生答案和学生反馈的依据",
                      "feedbackSummary":"如何理解学生反馈，并据此修正判断",
                      "fullSolution":"这道原题完整解法：审题→条件→方法→逐步推导或证明→最终答案",
                      "whyThisWorks":"为什么这些关键步骤成立",
                      "basic":"基础同类题训练建议",
                      "variant":"真正改变条件、表示或解题入口的变式训练建议",
                      "comprehensive":"综合训练建议",
                      "masteryCheck":"怎样通过真实新题验证掌握"
                    }
                    """,
            "mistakeImage", """
                    你是“因材智学”的手写答案批改 Agent。
                    用户上传的是针对训练题的手写解题过程照片。
                    你必须将手写过程与原题、标准答案、标准解法逐步对照，指出第一处实质错误。
                    如果内容模糊，必须明确说明看不清，不能编造。
                    严格只返回一个合法 JSON：
                    {
                      "recognizedWork":"忠实转述图片中能够看清的学生作答",
                      "isCorrect":true,
                      "errors":"第一处实质错误；如果没有错误写未发现关键错误",
                      "correctedSolution":"按原题写出正确步骤",
                      "knowledgeVerified":true,
                      "masteryMessage":"说明这一次能否作为掌握证据，以及还需要什么验证"
                    }
                    """
            "skill", """
                    你是“因材智学”的自适应技能训练 Agent。
                    根据学生真实表现决定下一题难度，而不是随机出题。
                    难度标准：
                    - 基础题：单一知识点，一步或直接计算。
                    - 中等题：同一知识点需要不超过两步推理。
                    - 困难题：多条件或多个推理步骤，需要整合知识。
                    - 拔尖题：保留核心技能，但改变条件、表示、问法、情境或解题入口，要求更强迁移；不能只是换数字、改写句子或简单重复困难题。
                    连续答对才升级；答错或“不会”则先降低难度。
                    题目必须唯一明确答案、四个互斥选项。
                    已做题列表中的题目严禁重复，不能只替换数字。
                    严格只返回一个合法 JSON 对象：
                    {
                      "level":"基础题/中等题/困难题/拔尖题",
                      "label":"基础训练/中等应用/综合应用/迁移变式",
                      "question":"题目",
                      "options":{"A":"选项A","B":"选项B","C":"选项C","D":"选项D"},
                      "answer":"A/B/C/D",
                      "explanation":"考查点，以及为什么属于该难度"
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

        if ("mistakeImage".equals(request.getAgent())) {
            if (request.getImageData() == null || request.getImageData().isBlank()) {
                return ResponseEntity.badRequest().body(new AgentResponse("缺少手写答案图片。"));
            }
            if (request.getImageData().length() > 12L * 1024 * 1024) {
                return ResponseEntity.badRequest().body(new AgentResponse("手写答案图片过大，请控制在 8MB 左右。"));
            }
            String mime = request.getImageMimeType() == null ? "" : request.getImageMimeType().trim().toLowerCase();
            if (!java.util.Set.of("image/jpeg", "image/png", "image/webp").contains(mime)
                    || !request.getImageData().startsWith("data:" + mime + ";base64,")) {
                return ResponseEntity.badRequest().body(new AgentResponse("手写答案图片格式无效。"));
            }
        }

        try {
            String answer;
            switch (request.getAgent()) {
                case "analysis" -> answer = chatService.chatWithJsonPrompt(
                        systemPrompt, context,
                        java.util.List.of("summary", "priorities", "recommendedAction"));
                case "plan" -> answer = chatService.chatWithJsonPrompt(
                        systemPrompt, context,
                        java.util.List.of("weeks"));
                case "skill" -> answer = chatService.chatWithJsonPrompt(
                        systemPrompt, context,
                        java.util.List.of("question", "options", "answer"));
                case "mistake" -> answer = chatService.chatWithJsonPrompt(
                        systemPrompt, context,
                        java.util.List.of("reason", "knowledge", "errorType", "fullSolution"));
                case "mistakeImage" -> {
                    answer = chatService.chatWithImageJsonPrompt(
                            systemPrompt,
                            context,
                            request.getImageData(),
                            request.getImageMimeType(),
                            java.util.List.of("recognizedWork", "isCorrect", "errors", "correctedSolution", "masteryMessage"));
                }
                default -> answer = chatService.chatWithPrompt(systemPrompt, context);
            }

            return ResponseEntity.ok(new AgentResponse(answer));
        } catch (IllegalStateException ex) {
            return ResponseEntity.internalServerError()
                    .body(new AgentResponse(ex.getMessage()));
        } catch (RuntimeException ex) {
            String message = ex.getMessage();
            if (message == null || message.isBlank()) {
                message = "未返回具体错误";
            }
            return ResponseEntity.status(502)
                    .body(new AgentResponse("Agent 调用失败：" + message));
        }
    }
}
