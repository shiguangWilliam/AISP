package com.medisage.api;
import com.medisage.app.AgentRequestService;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.medisage.utils.JwtUtils;
import com.medisage.utils.JwtUtils.UserInfo;

import jakarta.servlet.http.HttpServletResponse;

import java.util.Date;
import java.util.List;
import java.util.Map;
import com.medisage.db.DbController;
import com.alibaba.fastjson2.JSONObject;




@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private final AgentRequestService agentRequestService;
    private final DbController dbController;
    private final JwtUtils jwtUtils;

    public AgentController(AgentRequestService agentRequestService, DbController dbController, JwtUtils jwtUtils) {
        this.agentRequestService = agentRequestService;
        this.dbController = dbController;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping(value = "/create_session", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> postMethodName(@CookieValue(name = "token", required = false) String token, @RequestBody Map<String, Object> entity, HttpServletResponse response) {
        // 信息获取
        UserInfo userInfo = jwtUtils.getUserInfo(token);
        String userId = userInfo.getUserId();
        String agentId = entity.get("agent_id").toString();
        String agentType = entity.get("agent_type").toString();
        Date now = new Date();

        Map<String, Object> sessionInfo = null;
        String serverConversationId;
        try{
            // /stream 要求 prompt 非空；这里用最小 prompt 触发问候并拿到 conversation_id
            serverConversationId = agentRequestService.createConversationId(agentId);

        }catch(Exception e){
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sessionInfo = Map.of("error", "Failed to create session: " + e.getMessage());
            return sessionInfo;
        }
        try{
            // 会话创建
            long conversationId = dbController.createConversation(Long.parseLong(userId), agentType, agentId, now.toInstant(), serverConversationId);
            sessionInfo = Map.of(
            "conversation_id", conversationId,
            "agent_type", agentType,
            "agent_id", agentId,
            "created_at", now.toString(),
            "last_modified_at", now.toString()
            );
            return sessionInfo;
        }catch(Exception e){
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sessionInfo = Map.of("error", "Failed to create session: " + e.getMessage());
            return sessionInfo;
        }
        
    }

    /**
     * 真正的流式对话接口：SSE 逐块向前端转发清言 /stream 的 data。
     * 请求体: { assistant_id, conversation_id, prompt }
     */
    @PostMapping(value = "/stream", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamDialog(
        @CookieValue(name = "token", required = false) String token,
        @RequestBody Map<String, Object> payload,
        HttpServletResponse response
    ) {
        SseEmitter emitter = new SseEmitter(0L);

        // Optional auth check: if token invalid, emit an error event then complete.
        try {
            jwtUtils.getUserInfo(token);
        } catch (Exception e) {
            try {
                JSONObject err = new JSONObject();
                err.put("type", "error");
                err.put("error", "未登录");
                emitter.send(SseEmitter.event().data(err.toJSONString()));
            } catch (Exception ignored) {
                // ignore send error
            } finally {
                emitter.complete();
            }
            return emitter;
        }

        String assistantId = payload.getOrDefault("assistant_id", payload.getOrDefault("assistantId", "")).toString();
        String conversationId = payload.getOrDefault("conversation_id", payload.getOrDefault("conversationId", "")).toString();
        String prompt = payload.getOrDefault("prompt", payload.getOrDefault("message", "")).toString();

        agentRequestService.streamDialogMessage(
            assistantId,
            conversationId,
            prompt,
            (data) -> {
                try {
                    emitter.send(SseEmitter.event().data(data));
                    if ("[DONE]".equals(data)) emitter.complete();
                } catch (Exception sendErr) {
                    emitter.completeWithError(sendErr);
                }
            },
            (t) -> {
                try {
                    JSONObject err = new JSONObject();
                    err.put("type", "error");
                    err.put("error", t.getMessage());
                    emitter.send(SseEmitter.event().data(err.toJSONString()));
                } catch (Exception ignored) {
                    // ignore send error
                } finally {
                    emitter.completeWithError(t);
                }
            },
            () -> {
                try {
                    emitter.send(SseEmitter.event().data("[DONE]"));
                } catch (Exception ignored) {
                    // ignore send error
                }
                emitter.complete();
            }
        );

        return emitter;
    }
    

    // 列出会话
    @GetMapping(value = "/list_sessions", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> listSession(@CookieValue(name = "token", required = false) String token){
        try{
            JwtUtils.UserInfo userInfo = jwtUtils.getUserInfo(token);
            String userId = userInfo.getUserId();
             var result = dbController.listConversationsForUser(Long.parseLong(userId), 200);
            List<Map<String,Object>> sessions = result.stream().map(conversationRow -> Map.<String, Object>of(
                "id", conversationRow.getId(),
                "agent_type", conversationRow.getAgentType(),
                "server_session_id", conversationRow.getServerSessionId(),
                "created_at", conversationRow.getCreatedAt().toString(),
                "last_modified_at", conversationRow.getLastModifiedAt().toString()
            )).toList();
            return Map.of("sessions", sessions);
        }
        catch(Exception e){
            return Map.of("error", "Failed to list sessions: " + e.getMessage());
        }
    }

    // 获取会话历史（需要转发智能体）
    @PostMapping(value = "/get_session", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getSession(@CookieValue(name = "token", required = false) String token, @RequestBody Map<String, Object> payload){
        // 信息获取
        String conversationId = payload.get("conversation_id").toString();
        String userId = jwtUtils.getUserInfo(token).getUserId();   
        
        
        
        
        
        
        return payload;
        
    }


    // 对话开始（需要转发智能体）
    @PostMapping(value = "/dialog", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> dialog(@RequestBody Map<String, Object> payload){
        return payload;
        
    }

    
}
