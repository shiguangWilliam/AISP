package com.medisage.app;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;

import java.net.URI;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import com.alibaba.fastjson2.JSON;

@Service
public class AgentRequestService {
    private static final Logger log = LoggerFactory.getLogger(AgentRequestService.class);

    private final String agentUrl;
    // private final String assistantApi;
    private final String apiKey;
    private final String apiSecret;
    private final RestClient restClient;
    private TokenResult cachedToken = null;

    public AgentRequestService(
        @Value("${agent.url}") String agentUrl,
        @Value("${agent.api.key}") String apiKey,
        @Value("${agent.api.secret:}") String apiSecret
    ) {
        this.agentUrl = agentUrl == null ? "" : agentUrl.trim();
        // this.assistantApi = assistantApi == null ? "" : assistantApi.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.apiSecret = apiSecret == null ? "" : apiSecret.trim();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10_000);
        requestFactory.setReadTimeout(30_000);

        this.restClient = RestClient.builder()
            .requestFactory(requestFactory)
            .baseUrl(this.agentUrl)
            .build();
    }

    /**
     * 获取清言 assistant-api 的 access_token。
     * 接口：POST /get_token
     * 入参：{ api_key, api_secret }
     */
    public TokenResult getToken() {
        if (agentUrl.isBlank()) {
            return TokenResult.error(500, "Missing agent.url");
        }
        if (apiKey.isBlank() || apiSecret.isBlank()) {
            return TokenResult.error(500, "Missing agent.api.key or agent.api.secret");
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(agentUrl)
            .path("/get_token")
            .build(true)
            .toUri();

        JSONObject requestBody = new JSONObject();
        requestBody.put("api_key", apiKey);
        requestBody.put("api_secret", apiSecret);

        try {
            String raw = restClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(requestBody.toJSONString())
                .retrieve()
                .body(String.class);

            JSONObject json = JSON.parseObject(raw);
            int status = json.getIntValue("status", 1);
            String message = json.getString("message");

            // Spec lists access_token/expires_in; some responses wrap them under result.
            JSONObject result = json.getJSONObject("result");
            String token = result != null ? result.getString("access_token") : json.getString("access_token");
            long expiresIn = result != null
                ? result.getLongValue("expires_in", 0L)
                : json.getLongValue("expires_in", 0L);

            if (status != 0 || token == null || token.isBlank()) {
                String err = (message != null && !message.isBlank()) ? message : "get_token failed";
                return TokenResult.error(502, err);
            }
            cachedToken = TokenResult.ok(token, expiresIn);
            return cachedToken;
        } catch (RestClientResponseException e) {
            int httpStatus = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            String preview = body == null ? "" : (body.length() > 2000 ? body.substring(0, 2000) + "…" : body);
            log.warn("get_token upstream HTTP {}: {}", httpStatus, preview);
            return TokenResult.error(httpStatus, "get_token upstream error (HTTP " + httpStatus + ")");
        } catch (Exception e) {
            log.warn("get_token failed: {}", e.toString());
            return TokenResult.error(500, "get_token failed");
        }
    }

    public String getAssistantAuthToken() {

        if(cachedToken != null && cachedToken.isSuccess()) {
            return "Bearer " + "cachedToken.accessToken()";
        }
        else {
            TokenResult tokenResult = getToken();
            if(tokenResult.isSuccess()) {
                return "Bearer " + tokenResult.accessToken();
            } else {
                log.warn("Failed to get assistant auth token: {}", tokenResult.error());
                return null;
            }
        }
    }

    public DialogResult getDialogMessage(String assistantId, String conversationId,String message){

        String authToken = getAssistantAuthToken();
        if(authToken == null) {
            return DialogResult.error(500, "Failed to get auth token");
        }
        // 构建请求 URI 和请求体
        URI uri = UriComponentsBuilder.fromHttpUrl(agentUrl)
            .path("/stream") // 目前默认采用流式输出
            .build(true)
            .toUri();
        
        JSONObject requestBody = new JSONObject();
        requestBody.put("assistant_id", assistantId);
        requestBody.put("conversation_id", conversationId);
        requestBody.put("prompt", message);

        try{
            String raw = restClient.post()
                .uri(uri)
                .header("Authorization", authToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(requestBody.toJSONString())
                .retrieve()
                .body(String.class);

            JSONObject responseJson = JSON.parseObject(raw);
            int status = responseJson.getIntValue("status", 1);
            return DialogResult.ok(responseJson.toJSONString());

        }
        catch (RestClientResponseException e) {
            int httpStatus = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            String preview = body == null ? "" : (body.length() > 2000 ? body.substring(0, 2000) + "…" : body);
            log.warn("sendDialogMessage upstream HTTP {}: {}", httpStatus, preview);
            return DialogResult.error(httpStatus, "sendDialogMessage upstream error (HTTP " + httpStatus + ")");
        } catch (Exception e) {
            log.warn("sendDialogMessage failed: {}", e.toString());
            return DialogResult.error(500, "sendDialogMessage failed");
        }
        // 拿到dialog结果

        


    }

    public record SendResult(int status, String error) {
        public static SendResult ok() { return new SendResult(200, null); }
        public static SendResult invalid(String msg) { return new SendResult(400, msg); }
        public static SendResult tooManyRequests(String msg) { return new SendResult(429, msg); }
    }

    public record TokenResult(int status, String accessToken, long expiresInSeconds, String error) {
        public static TokenResult ok(String token, long expiresInSeconds) {
            return new TokenResult(200, token, expiresInSeconds, null);
        }

        public static TokenResult error(int status, String msg) {
            return new TokenResult(status, null, 0L, msg);
        }

        public boolean isSuccess() {
            return status == 200 && error == null && accessToken != null && !accessToken.isBlank();
        }
    }

    public record DialogResult(int status, String response, String error) {
        public static DialogResult ok(String response) {
            return new DialogResult(200, response, null);
        }

        public static DialogResult error(int status, String msg) {
            return new DialogResult(status, null, msg);
        }

        public boolean isSuccess() {
            return status == 200 && error == null && response != null;
        }
    }
}


