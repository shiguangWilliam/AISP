package com.medisage.utils;

import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import org.commonmark.Extension;
import org.commonmark.ext.gfm.tables.TablesExtension;
import org.commonmark.node.*;
import org.commonmark.parser.Parser;

import java.util.*;

public class MarkDownUtil {

	private static final String KEY_TYPE = "type";
	private static final String KEY_ATTRS = "attrs";
	private static final String KEY_CHILDREN = "children";
	private static final String KEY_LITERAL = "literal";

	private static final List<Extension> EXTENSIONS = List.of(
			TablesExtension.create()
	);

	private static final Parser PARSER = Parser.builder()
			.extensions(EXTENSIONS)
			.build();

	private MarkDownUtil() {
	}

	/**
	 * Parse Markdown into a JSON AST.
	 *
	 * <p>Output shape:
	 * <pre>
	 * {
	 *   "type": "document",
	 *   "children": [ ...nodes ]
	 * }
	 * </pre>
	 */
	public static JSONObject parseToJson(String markdown) {
		String safe = markdown == null ? "" : markdown;
		Node document = PARSER.parse(safe);
		return nodeToJson(document);
	}

	public static String parseToJsonString(String markdown) {
		return parseToJson(markdown).toJSONString();
	}

	private static JSONObject nodeToJson(Node node) {
		JSONObject obj = new JSONObject();
		obj.put(KEY_TYPE, toType(node));

		Map<String, Object> attrs = extractAttrs(node);
		if (!attrs.isEmpty()) {
			obj.put(KEY_ATTRS, new JSONObject(attrs));
		}

		JSONArray children = new JSONArray();
		for (Node child = node.getFirstChild(); child != null; child = child.getNext()) {
			children.add(nodeToJson(child));
		}
		if (!children.isEmpty()) {
			obj.put(KEY_CHILDREN, children);
		}

		return obj;
	}

	private static final Map<Class<?>, String> TYPE_MAP;
	static {
		Map<Class<?>, String> map = new HashMap<>();
		map.put(Document.class, "document");
		map.put(Paragraph.class, "paragraph");
		map.put(Heading.class, "heading");
		map.put(Text.class, "text");
		map.put(Emphasis.class, "emphasis");
		map.put(StrongEmphasis.class, "strong");
		map.put(SoftLineBreak.class, "softLineBreak");
		map.put(HardLineBreak.class, "hardLineBreak");
		map.put(BlockQuote.class, "blockquote");
		map.put(BulletList.class, "bulletList");
		map.put(OrderedList.class, "orderedList");
		map.put(ListItem.class, "listItem");
		map.put(Code.class, "inlineCode");
		map.put(IndentedCodeBlock.class, "codeBlock");
		map.put(FencedCodeBlock.class, "fencedCodeBlock");
		map.put(ThematicBreak.class, "thematicBreak");
		map.put(Link.class, "link");
		map.put(Image.class, "image");
		map.put(HtmlInline.class, "htmlInline");
		map.put(HtmlBlock.class, "htmlBlock");
		TYPE_MAP = Collections.unmodifiableMap(map);
	}

	private static String toType(Node node) {
		String mapped = TYPE_MAP.get(node.getClass());
		return mapped != null ? mapped : node.getClass().getSimpleName();
	}

	private static Map<String, Object> extractAttrs(Node node) {
		Map<String, Object> attrs = new LinkedHashMap<>();

		if (node instanceof Heading heading) {
			attrs.put("level", heading.getLevel());
		}

		if (node instanceof Text text) {
			attrs.put(KEY_LITERAL, text.getLiteral());
		}

		if (node instanceof Code code) {
			attrs.put(KEY_LITERAL, code.getLiteral());
		}

		if (node instanceof IndentedCodeBlock codeBlock) {
			attrs.put(KEY_LITERAL, codeBlock.getLiteral());
		}

		if (node instanceof FencedCodeBlock fenced) {
			attrs.put("info", fenced.getInfo());
			attrs.put(KEY_LITERAL, fenced.getLiteral());
		}

		if (node instanceof Link link) {
			attrs.put("destination", link.getDestination());
			attrs.put("title", link.getTitle());
		}

		if (node instanceof Image image) {
			attrs.put("destination", image.getDestination());
			attrs.put("title", image.getTitle());
		}

		if (node instanceof BulletList bulletList) {
			attrs.put("tight", bulletList.isTight());
		}

		if (node instanceof OrderedList orderedList) {
			attrs.put("tight", orderedList.isTight());
		}

		if (node instanceof HtmlInline htmlInline) {
			attrs.put(KEY_LITERAL, htmlInline.getLiteral());
		}

		if (node instanceof HtmlBlock htmlBlock) {
			attrs.put(KEY_LITERAL, htmlBlock.getLiteral());
		}

		return attrs;
	}
}
