import { getConfig, setConfig, getSoundModesConfig } from "./avr-transport.ts"; // Point to your actual client file path

/**
 * AVR Control Client Wrappers
 * This layer abstracts raw numeric configuration types into explicit, documented methods.
 */
export const avr = {
	/**
	 * Retrieves the master audio configurations (Volume, Mute, Bass, Treble)
	 */
	async getAudioStatus() {
		// Replace "audio" and "2" with your actual auto-discovered module and type ID
		const data = await getConfig("globals", "12");

		return {
			// Automatically cast string responses to clean JavaScript primitives
			volume: parseInt(data.listGlobals_MainZone_Volume || "0", 10) / 10,
			isMuted: data.listGlobals_MainZone_Mute === "1",
		};
	},

	/**
	 * Powers on the Main Zone of the amplifier.
	 */
	async turnOn() {
		const xml = "<MainZone><Power>1</Power></MainZone>";
		return setConfig("globals", 4, xml);
	},

	/**
	 * Powers down the Main Zone of the amplifier (puts it into Standby).
	 */
	async turnOff() {
		const xml = "<MainZone><Power>3</Power></MainZone>";
		return setConfig("globals", 4, xml);
	},

	/**
	 * Gets the active input source of the receiver (e.g., HDMI1, Phono, TV)
	 */
	async getSource() {
		// Replace "control" and "4" with your auto-discovered input source type configuration
		const data = await getConfig("control", "1");

		return {
			currentSource: data.mainZone_Source || "Unknown",
		};
	},

	/**
	 * Fetches current system power state and standby parameters
	 */
	async getPowerState() {
		// Replace with your auto-discovered power settings layout block
		const data = await getConfig("globals", "4");

		return data.listGlobals_MainZone_Power === "1";
	},

	async getCurrentSource() {
		// Fetch source dictionary and active control state concurrently
		const [sourceMap, controlState] = await Promise.all([
			this.getSources(),
			// Targets 'control', type 1 or 4 depending on where your webapp pulled '7' from
			getConfig("control", "1"),
		]);

		const controlFields = controlState as Record<string, string>;

		/**
		 * Dynamic value scavenger:
		 * Instead of relying on a hardcoded string key name, we scan the payload values
		 * for a numeric match (like "7") that aligns with an item in your inputs map.
		 */
		let activeIndexStr = "";

		// Find the first field containing a numeric string that matches one of our source indices
		for (const val of Object.values(controlFields)) {
			const cleanVal = String(val).trim();
			const numericValue = parseInt(cleanVal, 10);

			// Check if this property value corresponds to an available hardware input channel
			if (
				!Number.isNaN(numericValue) &&
				sourceMap.inputs.some((input: {index: number}) => input.index === numericValue)
			) {
				activeIndexStr = cleanVal;
				break;
			}
		}

		const activeIndex = parseInt(activeIndexStr || "0", 10);

		// Map the recovered integer token to its clean text profile string
		const matchingSource = sourceMap.inputs.find(
			(input: {index: number}) => input.index === activeIndex,
		);

		return {
			index: activeIndex,
			name: matchingSource
				? matchingSource.name
				: `Unknown Input Channel (Index: ${activeIndex})`,
			zone: sourceMap.zone,
		};
	},

	/**
	 * Fetches and dynamically parses all available input sources and their lookup indices.
	 * Maps flat keys like 'sourceList_Zone_Source_0_Name' into a clean structured array.
	 */
	async getSources() {
		// Fetch raw flat configuration data from globals -> type 7
		const data = await getConfig("globals", "7");

		const sources: Array<{ index: number; name: string }> = [];

		// Loop through keys dynamically to group Name and Index fields together
		// Using a loose record cast so we can iterate by string index offsets safely
		const rawFields = data as Record<string, string>;

		// Loop up to an arbitrary high index (or parse keys dynamically)
		for (let i = 0; i <= 25; i++) {
			const nameKey = `sourceList_Zone_Source_${i}_Name`;
			const indexKey = `sourceList_Zone_Source_${i}_index`;

			// If the specific slot doesn't exist in the returned config, we've hit the end
			if (!rawFields[nameKey]) break;

			sources.push({
				index: parseInt(rawFields[indexKey] || "0", 10),
				name: rawFields[nameKey],
			});
		}

		return {
			zone: parseInt(rawFields.sourceList_Zone_zone || "0", 10),
			zoneIndex: parseInt(rawFields.sourceList_Zone_index || "0", 10),
			inputs: sources,
		};
	},

	/**
	 * Changes the active input source configuration channel.
	 * @param sourceIndex The numeric target identification string or number (e.g., 7)
	 */
	async setSource(sourceIndex: string | number) {
		// Build the precise XML element layout with zone and index attributes
		// We use zone="1" to align with your tracked network signature payload
		const xml = `<Source zone="1" index="${sourceIndex}"></Source>`;

		// Dispatch directly to the 'globals' module under type ID 7
		return setConfig("globals", 7, xml);
	},
	/**
	 * Sets the absolute volume level for the Main Zone.
	 * @param level Integer representing the target volume (e.g., 40)
	 */
	async setVolume(level: number | string) {
		const cleanLevel = parseInt(String(level), 10);

		/**
		 * 3-Digit Scaling Multiplier:
		 * Because your network trace passed "555" for volume, your device expects an extra
		 * digit precision flag (e.g. 55 -> 550 or 555). We append a "0" or compute the baseline
		 * string signature tightly on a single row.
		 */
		const avrVolumeValue = `${cleanLevel}0`;

		console.log(avrVolumeValue);
		// Single row literal template to avoid trailing spacing anomalies
		const xml = `<MainZone><Volume>${avrVolumeValue}</Volume></MainZone>`;

		// Target 'globals' type 12 based on your verified request log trace
		return setConfig("globals", 12, xml);
	},
	/**
	 * Toggles the audio muting state of the Main Zone.
	 * @param shouldMute boolean flag indicating destination layout state
	 */
	async setMute(shouldMute: boolean) {
		// Try passing "on" / "off". If your AVR rejects this, toggle Option B below
		const stateToken = shouldMute ? "on" : "off";

		// Option B Fallback (Uncomment if needed):
		// const stateToken = shouldMute ? "1" : "0";

		const xml = `<MainZone><Mute>${stateToken}</Mute></MainZone>`;

		// Dispatches to globals type 12 matching your verified volume endpoint layout
		return setConfig("globals", 12, xml);
	},

	/**
	 * Fetches available sound modes, parses attributes, and determines which is currently active.
	 */
	async getSoundModes() {
		// Pure delegation to the transport layer
		return getSoundModesConfig();
	},

	/**
	 * Updates the active hardware DSP Sound Mode matrix.
	 */
	async setSoundMode(modeIndex: string | number) {
		// 1. Coerce to integer to strip quotes or trailing formatting characters
		const cleanIndex = parseInt(String(modeIndex), 10);

		// 2. Keep the literal template completely on a single tight row
		const xml = `<SoundMode>${cleanIndex}</SoundMode>`;

		// 3. Dispatch to control, type 4 matching your verified inspector log
		return setConfig("control", 4, xml);
	},
};
