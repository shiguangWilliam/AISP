package com.medisage.utils;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MarkDownUtilTests {

    @Test
    void parsesBasicMarkdownToJsonAst() {
        String md = "# Title\n\nHello **world**\n\n- a\n- b\n\n```java\nSystem.out.println(\"x\");\n```\n";
        JSONObject json = MarkDownUtil.parseToJson(md);

        assertEquals("document", json.getString("type"));
        assertTrue(json.containsKey("children"));
        assertFalse(json.getJSONArray("children").isEmpty());

        // Basic sanity checks: should contain at least one heading node and one fencedCodeBlock.
        String asString = json.toJSONString();
        assertTrue(asString.contains("\"type\":\"heading\""));
        assertTrue(asString.contains("\"type\":\"fencedCodeBlock\""));
        assertTrue(asString.contains("\"info\":\"java\""));
    }
}
