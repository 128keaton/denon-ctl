import { XMLParser } from "fast-xml-parser";
import {
	CONFIG_REGISTRY,
	type AVRModule,
	type ConfigType,
	type ParsedResponse,
} from "./avr-registry";

const AVR_ADDRESS = "10.0.1.202";
const AVR_PORT = "11080";
const BASE_URL = `http://${AVR_ADDRESS}:${AVR_PORT}/ajax`;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "",
});

/**
 * Specialized Transport Reader for nested XML collections with active attribute flags.
 * Used for complex lists like Sound Modes.
 */
const getSoundModesConfig = async (): Promise<{
	genre: number;
	currentMode: string;
	currentIndex: number;
	modes: Array<{ index: number; name: string }>;
}> => {
	const url = `${BASE_URL}/control/get_config?type=9`;
	const response = await fetch(url);
	const xmlText = await response.text();

	// Parse keeping attributes intact
	const jsonObj = parser.parse(xmlText);

	const rawItems = jsonObj?.SoundModeSettings?.SoundMode?.List?.Item || [];
	const itemsArray = Array.isArray(rawItems) ? rawItems : [rawItems];

	const modes = itemsArray.map((item: any) => ({
		index: parseInt(item.index || "0", 10),
		name: String(item["#text"] || ""),
		isActive: String(item.selected) === "1",
	}));

	const currentActive = modes.find((m) => m.isActive);

	return {
		genre: parseInt(jsonObj?.SoundModeSettings?.Genre || "0", 10),
		currentMode: currentActive ? currentActive.name : "Unknown Mode",
		currentIndex: currentActive ? currentActive.index : 0,
		modes: modes.map(({ index, name }) => ({ index, name })),
	};
};

// Deep nested reader utility - updated to accurately parse leaf elements & attributes
function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((acc, part) => {
		if (acc && typeof acc === "object") {
			// Check for explicit key matches first (including attributes and #text keys)
			if (acc[part] !== undefined) {
				return acc[part];
			}
			// Fallback block if an expected structural container drops off
			return acc["#text"];
		}
		return acc;
	}, obj);
}

/**
 * Core Data Submitter (Writer)
 * Placed here to match getConfig's architectural scope.
 */
const setConfig = async (
	moduleName: AVRModule | string,
	type: string | number,
	xmlData: string,
): Promise<string> => {
	const encodedData = encodeURIComponent(xmlData);
	const cacheBuster = Date.now();
	const url = `${BASE_URL}/${moduleName}/set_config?type=${type}&data=${encodedData}&_=${cacheBuster}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`AVR write action failed with status code: ${response.status}`,
		);
	}

	return await response.text();
};

const getConfig = async <M extends AVRModule, T extends ConfigType<M>>(
	moduleName: M,
	type: T,
): Promise<ParsedResponse<M, T>> => {
	const schema = CONFIG_REGISTRY[moduleName][type];

	const url = `${BASE_URL}/${moduleName}/get_config?type=${String(type)}`;
	const response = await fetch(url);
	const xmlText = await response.text();
	const jsonObj = parser.parse(xmlText);

	const result: Record<string, string> = {};
	for (const [xmlPath, targetKey] of Object.entries(
		schema as Record<string, string>,
	)) {
		const rawValue = getNestedValue(jsonObj, xmlPath);
		result[targetKey] =
			typeof rawValue === "object"
				? JSON.stringify(rawValue)
				: String(rawValue ?? "");
	}

	return result as ParsedResponse<M, T>;
};

export { getConfig, setConfig, getSoundModesConfig };
