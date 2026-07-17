import { avr } from "./avr-client";

async function run() {
	console.log("Fetching AVR system details...");

	await avr.turnOn();

	// 1. Read cleanly separated volume structures
	const audio = await avr.getAudioStatus();
	console.log(`🔊 Master Volume: ${audio.volume} dB (Muted: ${audio.isMuted})`);

	// 2. Read active source profiles
	const source = await avr.getSource();
	console.log(`🔌 Current Input Source: ${source.currentSource}`);

	// 3. Conditional validation rules run flawlessly
	if (await avr.getPowerState()) {
		console.log("⚡ AVR status: Operational");
	} else {
		console.log("💤 AVR status: Standby Mode");
	}

	const sourceMap = await avr.getCurrentSource();
	console.log(sourceMap);
}

run().catch(console.error);
