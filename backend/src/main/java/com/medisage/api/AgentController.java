package com.medisage.api;
import com.medisage.app.AgentRequestService;
import com.medisage.app.AgentRequestService.DialogResult;

import org.springframework.boot.autoconfigure.security.oauth2.resource.OAuth2ResourceServerProperties.Jwt;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.medisage.utils.JwtUtils;
import com.medisage.utils.JwtUtils.UserInfo;

import jakarta.servlet.http.HttpServletResponse;

import java.util.Date;
import java.util.List;
import java.util.Map;
import com.medisage.db.DbController;

import com.alibaba.fastjson2.JSON;
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
            String message = "";// initial message
            
            JSONObject serverResponse = JSON.parseObject(agentRequestService.getDialogMessage(agentId, message).toString());
            serverConversationId = serverResponse.getString("conversation_id");

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
