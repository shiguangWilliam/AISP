package com.medisage.app;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import jakarta.annotation.PreDestroy;

@Service
public class AgentRequestService {
    private static final Logger log = LoggerFactory.getLogger(AgentRequestService.class);

    private final String agentUrl;
    // private final String assistantApi;
    private final String apiKey;
    private final String apiSecret;
    private final RestClient restClient;
    private final HttpClient httpClient;
    private final ExecutorService streamExecutor;
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

        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
        this.streamExecutor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "qingyan-stream");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    public void shutdown() {
        try {
            streamExecutor.shutdown();
            if (!streamExecutor.awaitTermination(2, TimeUnit.SECONDS)) {
                streamExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            streamExecutor.shutdownNow();
        }
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
            return "Bearer " + cachedToken.accessToken();
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
    public DialogResult getDialogMessage(String assistantId, String message){
        return getDialogMessage(assistantId, "", message);
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

        // NOTE: This method keeps legacy behavior (aggregate full upstream response into one String).
        // For true streaming, use streamDialogMessage().
        try{
            String raw = restClient.post()
                .uri(uri)
                .header("Authorization", authToken)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .body(requestBody.toJSONString())
                .retrieve()
                .body(String.class);

            return DialogResult.ok(raw);

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

    /**
     * 真正的流式转发：逐行读取上游 SSE 的 data 字段，并回调给调用方。
     * onData 接收到的字符串不包含前缀 "data:"，与前端解析逻辑一致。
     */
    public CompletableFuture<Void> streamDialogMessage(
        String assistantId,
        String conversationId,
        String prompt,
        Consumer<String> onData,
        Consumer<Throwable> onError,
        Runnable onComplete
    ) {
        Objects.requireNonNull(onData, "onData");
        final Consumer<Throwable> errorHandler = (onError != null) ? onError : t -> {};
        final Runnable completeHandler = (onComplete != null) ? onComplete : () -> {};

        final String authToken = getAssistantAuthToken();
        if (authToken == null) {
            Throwable t = new IllegalStateException("Failed to get auth token");
            errorHandler.accept(t);
            return CompletableFuture.failedFuture(t);
        }
        final String effectivePrompt = (prompt == null || prompt.isBlank()) ? "你好" : prompt;

        final URI uri = UriComponentsBuilder.fromHttpUrl(agentUrl)
            .path("/stream")
            .build(true)
            .toUri();

        final JSONObject requestBody = new JSONObject();
        requestBody.put("assistant_id", assistantId);
        requestBody.put("conversation_id", conversationId == null ? "" : conversationId);
        requestBody.put("prompt", effectivePrompt);

        HttpRequest req = HttpRequest.newBuilder(uri)
            .timeout(Duration.ofMinutes(5))
            .header("Authorization", authToken)
            .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
            .header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
            .POST(HttpRequest.BodyPublishers.ofString(requestBody.toJSONString(), StandardCharsets.UTF_8))
            .build();

        return CompletableFuture.runAsync(() -> {
            try {
                HttpResponse<InputStream> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int status = resp.statusCode();
                if (status < 200 || status >= 300) {
                    try (InputStream is = resp.body()) {
                        String preview = new String(is.readNBytes(4096), StandardCharsets.UTF_8);
                        throw new RuntimeException("upstream HTTP " + status + ": " + preview);
                    }
                }

                try (InputStream is = resp.body();
                     BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        if (line.isEmpty()) continue;
                        if (line.startsWith("data:")) {
                            String data = line.substring(5).trim();
                            if (!data.isEmpty()) {
                                onData.accept(data);
                                if ("[DONE]".equals(data)) break;
                            }
                        }
                    }
                }
                completeHandler.run();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                errorHandler.accept(e);
                throw new RuntimeException(e);
            } catch (Exception e) {
                errorHandler.accept(e);
                throw new RuntimeException(e);
            }
        }, streamExecutor);
    }

    /**
     * 用最小 prompt 触发清言创建会话，并从 SSE 事件中解析 conversation_id。
     */
    public String createConversationId(String assistantId) {
        final String[] conversationIdHolder = new String[1];
        final Object lock = new Object();

        CompletableFuture<Void> fut = streamDialogMessage(
            assistantId,
            "",
            "你好",
            (data) -> {
                if (conversationIdHolder[0] != null) return;
                try {
                    JSONObject obj = JSON.parseObject(data);
                    String cid = obj.getString("conversation_id");
                    if (cid == null) {
                        JSONObject result = obj.getJSONObject("result");
                        if (result != null) cid = result.getString("conversation_id");
                    }
                    if (cid != null && !cid.isBlank()) {
                        conversationIdHolder[0] = cid;
                        synchronized (lock) {
                            lock.notifyAll();
                        }
                    }
                } catch (Exception ignored) {
                    // ignore non-json data
                }
            },
            (t) -> {
                synchronized (lock) {
                    lock.notifyAll();
                }
            },
            () -> {
                synchronized (lock) {
                    lock.notifyAll();
                }
            }
        );

        long deadline = System.currentTimeMillis() + 15_000;
        synchronized (lock) {
            while (conversationIdHolder[0] == null && System.currentTimeMillis() < deadline && !fut.isCompletedExceptionally()) {
                try {
                    lock.wait(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        String cid = conversationIdHolder[0];
        if (cid == null || cid.isBlank()) {
            throw new RuntimeException("Failed to obtain conversation_id from upstream stream");
        }
        return cid;
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

        public String toString(){
            return response;
        }
    }
}


