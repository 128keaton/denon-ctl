import * as fs from "node:fs";
import { XMLParser } from "fast-xml-parser";

const AVR_ADDRESS = "10.0.1.202";
const AVR_PORT = "11080";
const BASE_URL = `http://${AVR_ADDRESS}:${AVR_PORT}/ajax`;
const MODULES = [
	"globals",
	"general",
	"audio",
	"control",
	"advanced",
	"speakers",
	"inputs",
	"video",
] as const;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "",
});

function extractFlatKeys(
	obj: any,
	currentPath: string[] = [],
): Record<string, string> {
	const results: Record<string, string> = {};

	if (obj === null || obj === undefined) return results;

	// Base case: If it's a direct primitive value (no attributes)
	if (typeof obj !== "object") {
		const fullXmlPath = currentPath.join(".");
		const cleanKey = currentPath
			.map((p, idx) => (idx === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p))
			.join("_");
		results[fullXmlPath] = cleanKey;
		return results;
	}

	// Special Case: Tag with attributes and text node
	if ("#text" in obj && Object.keys(obj).length > 1) {
		for (const [key, _value] of Object.entries(obj)) {
			const nextPath = [...currentPath, key];
			// Format key: language_text or language_group
			const cleanKey =
				currentPath
					.map((p, idx) =>
						idx === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p,
					)
					.join("_") +
				"_" +
				(key === "#text" ? "text" : key);

			results[nextPath.join(".")] = cleanKey;
		}
		return results;
	}

	// Normal traversal for nested trees
	for (const [key, value] of Object.entries(obj)) {
		if (key === "?xml") continue;
		const nextPath = [...currentPath, key];
		Object.assign(results, extractFlatKeys(value, nextPath));
	}

	return results;
}

async function autoDiscoverAllModules() {
	console.log("Deep-scraping nested AVR multi-module configurations...");
	const registry: Record<string, Record<string, Record<string, string>>> = {};

	for (const mod of MODULES) {
		registry[mod] = {};
		for (let typeId = 1; typeId <= 25; typeId++) {
			try {
				const url = `${BASE_URL}/${mod}/get_config?type=${typeId}`;
				const response = await fetch(url);
				if (!response.ok) continue;

				const xmlText = await response.text();
				if (!xmlText.trim()) continue;

				const jsonObj = parser.parse(xmlText);
				const flatMappings = extractFlatKeys(jsonObj);

				if (Object.keys(flatMappings).length > 0) {
					registry[mod][String(typeId)] = flatMappings;
					console.log(`  ✅ type=${typeId} discovered`);
				}
			} catch (_e) {}
		}
	}

	const code = `// Auto-generated configuration registry
export const CONFIG_REGISTRY = ${JSON.stringify(registry, null, 4)} as const;
export type AVRModule = keyof typeof CONFIG_REGISTRY;

export type ConfigType<M extends AVRModule> = keyof typeof CONFIG_REGISTRY[M];

// 1. Isolate the exact configuration object type safely
type GetConfigSchema<M extends AVRModule, T extends ConfigType<M>> = typeof CONFIG_REGISTRY[M][T];

// 2. Remap the configuration safely, completely skipping empty objects \`{}\`
export type ParsedResponse<M extends AVRModule, T extends ConfigType<M>> =
    keyof GetConfigSchema<M, T> extends never
    ? Record<string, string>
    : {
        [K in keyof GetConfigSchema<M, T> as GetConfigSchema<M, T>[K] extends string | number | symbol
            ? GetConfigSchema<M, T>[K]
            : never
        ]: string;
    };`;

	fs.writeFileSync("./avr-registry.ts", code);
	console.log(
		"\n🎉 Done! Regenerated './avr-registry.ts' with precise text/attribute handling.",
	);
}

autoDiscoverAllModules();
